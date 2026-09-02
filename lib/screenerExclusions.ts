// Tickers excluded from screener runs — from Greg's "Trending Stocks Exclusion" doc.
// No maintained per-ticker reasons; treat any ticker here as excluded regardless of screener criteria.
export const SCREENER_EXCLUDED_TICKERS = new Set([
  "ABBV", "ACA", "ADX", "AES", "AGCO", "ALRM", "AMR", "AMT", "ANDG", "APA", "APD", "APGE", "APPF",
  "ARGX", "AR", "ARLP", "ARX", "ATAI", "ATKR", "ATRC", "AWK", "AVTR", "BCE", "BLCO", "BLSH", "BR",
  "BSBR", "BSM", "BSTZ", "BTU", "BXSL", "CART", "CBZ", "CCC", "CDLR", "CDW", "CF", "CHEF", "CHRD",
  "CKHP", "CLMT", "CMBT", "CME", "CMG", "CNH", "CNR", "CNX", "COKE", "COR", "CQP", "CRCL", "CRGY",
  "CRNX", "CSQ", "CVI", "DBRG", "DINO", "DIS", "DLTR", "DNP", "DOX", "DSGX", "DT", "DUKU", "DVN",
  "ECO", "EDU", "EE", "ELPC", "EPD", "ESNT", "EQT", "ET", "ETG", "EXE", "EXEL", "EXG", "EXLS", "EXPO",
  "FDS", "FLR", "FRHC", "FRO", "FTI", "G", "GBTG", "GEL", "GEN", "GFL", "GIB", "GMAB", "GNW", "GPOR",
  "GWRE", "HAFN", "HALO", "HCC", "HESM", "HLN", "HLNE", "HP", "HSIC", "HTFL", "HTGC", "IBKR", "IBN",
  "IHSG", "IMCR", "IMO", "INSW", "ITGR", "IQV", "J", "KFY", "KNTK", "KT", "KVYO", "KYN", "LFSTI",
  "LH", "LNG", "LPG", "LPLA", "LXP", "MEOH", "MFG", "MGY", "MICC", "MKTX", "MMED", "MMSI", "MORN",
  "MOS", "MRP", "MTDR", "MTG", "MUFG", "NDAQ", "NFG", "NOG", "NOV", "NSIT", "OGN", "OGS", "OKE",
  "OTF", "OXY", "OVV", "PAA", "PAG", "PAGP", "PAYO", "PBF", "PCTY", "PEGA", "PEN", "PKX", "PJT",
  "PLSE", "PR", "PRGO", "PRGS", "PS", "PSKY", "PTC", "PTEN", "PTY", "QURE", "RAMP", "RCI", "RELY",
  "RGA", "RHI", "RJF", "RNG", "RNR", "RNW", "ROKU", "ROP", "RPRX", "RRC", "RSG", "SAIC", "SBAC",
  "SDRL", "SEIC", "SHEL", "SHG", "SLAB", "SLDE", "SM", "SMFG", "SN", "SOLV", "SR", "SSNC", "SUN",
  "SUNC", "SUZ", "STDN", "STEP", "STRC", "SXT", "TAK", "TARS", "TBBB", "TDW", "TECH", "TFX", "TPG",
  "TRMD", "TRU", "TTC", "TTE", "TVTX", "TW", "TXNM", "TYL", "UGP", "USAC", "UTZ", "VEON", "VERX",
  "VET", "VG", "VIR", "VIST", "VNOM", "VOD", "VOYA", "VRSN", "VSNT", "WAT", "WAY", "WBD", "WBS",
  "WDS", "WES", "WF", "WFC", "WFRD", "WRTG", "XP", "YPF", "VALE",
]);
