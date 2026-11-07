import os
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import requests

from app.config import settings

XML_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

def download_pink_sheet(dest_path: Optional[Path] = None, force: bool = False) -> Path:
    target = dest_path or (settings.RAW_DATA_DIR / "CMO-Historical-Data-Monthly.xlsx")
    target.parent.mkdir(parents=True, exist_ok=True)
    
    # Download if not present, empty, or forced
    if force or not target.exists() or target.stat().st_size == 0:
        headers = {"User-Agent": "CommodiSense/1.0 (+https://commodisense.local)"}
        resp = requests.get(settings.WORLD_BANK_PINK_SHEET_URL, headers=headers, timeout=30)
        resp.raise_for_status()
        target.write_bytes(resp.content)
        
    return target

def parse_pink_sheet_xml(xlsx_path: Path) -> Dict[str, Any]:
    """Parse World Bank Pink Sheet without external Excel libraries using stdlib zipfile and XML."""
    with zipfile.ZipFile(xlsx_path, "r") as z:
        # 1. Read shared strings
        sst_tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
        strings = []
        for si in sst_tree.findall(f"{XML_NS}si"):
            t = si.find(f"{XML_NS}t")
            if t is not None and t.text:
                strings.append(t.text)
            else:
                txts = [node.text for node in si.findall(f".//{XML_NS}t") if node.text]
                strings.append("".join(txts))
                
        # 2. Parse sheet2.xml (Monthly Prices)
        sheet_tree = ET.fromstring(z.read("xl/worksheets/sheet2.xml"))
        rows = sheet_tree.findall(f".//{XML_NS}row")
        
        # Row 5 has series names, Row 6 has units
        r5 = rows[4]
        r6 = rows[5]
        
        col_names: Dict[str, str] = {}
        for c in r5.findall(f"{XML_NS}c"):
            ref = c.attrib.get("r", "")
            col = "".join(ch for ch in ref if ch.isalpha())
            v = c.find(f"{XML_NS}v")
            val = strings[int(v.text)] if v is not None and c.attrib.get("t") == "s" else (v.text if v is not None else "")
            col_names[col] = val or ""
            
        col_units: Dict[str, str] = {}
        for c in r6.findall(f"{XML_NS}c"):
            ref = c.attrib.get("r", "")
            col = "".join(ch for ch in ref if ch.isalpha())
            v = c.find(f"{XML_NS}v")
            val = strings[int(v.text)] if v is not None and c.attrib.get("t") == "s" else (v.text if v is not None else "")
            col_units[col] = val or ""
            
        # Locate exact Gold and Crude Oil columns
        # Brent: Column C ("Crude oil, Brent")
        # Gold: Column BR ("Gold")
        gold_col = None
        oil_col = None
        for col, name in col_names.items():
            name_lower = name.lower()
            if "gold" in name_lower and not gold_col:
                gold_col = col
            if "crude oil, brent" in name_lower and not oil_col:
                oil_col = col
                
        if not gold_col or not oil_col:
            # Fallback to known structural columns
            gold_col = gold_col or "BR"
            oil_col = oil_col or "C"
            
        gold_meta = {"name": col_names.get(gold_col, "Gold"), "unit": col_units.get(gold_col, "$/troy oz"), "col": gold_col}
        oil_meta = {"name": col_names.get(oil_col, "Crude oil, Brent"), "unit": col_units.get(oil_col, "$/bbl"), "col": oil_col}
        
        # 3. Parse data rows (row index >= 6)
        records = []
        for r in rows[6:]:
            cell_dict = {}
            for c in r.findall(f"{XML_NS}c"):
                ref = c.attrib.get("r", "")
                col = "".join(ch for ch in ref if ch.isalpha())
                v = c.find(f"{XML_NS}v")
                if v is not None and v.text:
                    val = strings[int(v.text)] if c.attrib.get("t") == "s" else v.text
                    cell_dict[col] = val
                    
            date_str = cell_dict.get("A")
            if not date_str or "M" not in date_str:
                continue
                
            # Date format is YYYYMmm, e.g. 1960M01 -> 1960-01-01
            parts = date_str.split("M")
            if len(parts) != 2:
                continue
            year, month = int(parts[0]), int(parts[1])
            iso_date = f"{year:04d}-{month:02d}-01"
            
            # Parse values
            def parse_num(val_str):
                if val_str is None or val_str.strip() in ("", "...", "", "NA", "null"):
                    return None
                try:
                    return float(val_str)
                except ValueError:
                    return None

            records.append({
                "date": iso_date,
                "raw_date": date_str,
                "gold": parse_num(cell_dict.get(gold_col)),
                "oil": parse_num(cell_dict.get(oil_col))
            })
            
        return {
            "gold_meta": gold_meta,
            "oil_meta": oil_meta,
            "records": records,
            "total_rows": len(records)
        }
