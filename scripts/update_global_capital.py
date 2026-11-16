#!/usr/bin/env python3
"""Fetch World Bank stock market capitalization and GDP; retain last good values on failure."""
import json, pathlib, urllib.request, datetime
DEST=pathlib.Path("public/data/global-capital.json")
CODES={"US":"미국","CN":"중국","JP":"일본","IN":"인도","KR":"한국","DE":"독일","GB":"영국","FR":"프랑스"}
INDICATORS={"stockMarketCap":"CM.MKT.LCAP.CD","gdp":"NY.GDP.MKTP.CD"}
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"SIGMA-global-capital/1.0"})
    with urllib.request.urlopen(req,timeout=25) as response:return json.load(response)
def series(code,indicator):
    url=f"https://api.worldbank.org/v2/country/{code}/indicator/{indicator}?format=json&per_page=100"
    data=fetch(url)
    if not isinstance(data,list) or len(data)<2 or not isinstance(data[1],list):raise ValueError("Unexpected World Bank response")
    return {str(int(r["date"])):round(float(r["value"])/1e12,4) for r in data[1] if r.get("value") is not None and str(r.get("date","")).isdigit()}
def main():
    old=json.loads(DEST.read_text()) if DEST.exists() else {}
    output={"source":"World Bank Open Data","sourceUrl":"https://data.worldbank.org/indicator/CM.MKT.LCAP.CD","updatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"units":"USD trillions","series":{},"countries":{},"warnings":[]}
    for key,indicator in INDICATORS.items():
        try:
            points=series("WLD",indicator)
            if not points:raise ValueError("Empty global series")
            output["series"][key]=points
        except Exception as exc:
            if key in old.get("series",{}):
                output["series"][key]=old["series"][key]
                output["warnings"].append(f"{key}: previous data retained ({type(exc).__name__})")
            else:raise
    for code,name in CODES.items():
        try:
            values=series(code,INDICATORS["stockMarketCap"])
            if values:output["countries"][code]={"name":name,"series":values}
        except Exception as exc:
            if code in old.get("countries",{}):
                output["countries"][code]=old["countries"][code]
                output["warnings"].append(f"{code}: previous data retained ({type(exc).__name__})")
            else:output["warnings"].append(f"{code}: unavailable ({type(exc).__name__})")
    # Reject implausible regression to tiny data sets.
    if len(output["series"]["stockMarketCap"])<5:raise ValueError("Too few annual observations")
    DEST.parent.mkdir(parents=True,exist_ok=True)
    serialized=json.dumps(output,ensure_ascii=False,indent=2,sort_keys=True)+"\n"
    if old:
        comparable=lambda d:{"series":d.get("series"),"countries":d.get("countries"),"warnings":d.get("warnings")}
        if comparable(old)==comparable(output):print("No source data changes");return
    DEST.write_text(serialized)
    print("Updated",DEST)
if __name__=="__main__":main()
