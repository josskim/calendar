import pandas as pd
import sys

file_path = r"C:\intranet\doc\DOMESIN_ORDER_202603030920.xls"
try:
    df = pd.read_excel(file_path, header=None)
    print(f"Total rows: {len(df)}")
    print(f"Max columns: {df.shape[1]}")
    print("First 5 rows:")
    print(df.head(5))
except Exception as e:
    print(f"Error: {e}")
