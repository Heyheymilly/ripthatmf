from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import subprocess

class ConvertRequest(BaseModel):
    url: str
    title: str

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
    ],
    allow_methods=["*"],
    allow_headers=["*"]
)

def download_audio(url:str) -> str:
    if not url:
        raise ValueError("Missing URL")
    output_dir = Path(r"C:\Users\milto\Music\Beginning\converted")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_template = output_dir / "%(title)s.%(ext)s"

    subprocess.run(
    [
        "yt-dlp",
        "-f",
        "bestaudio/best",
        "-o",
        str(output_template),
        url,
    ],
    check=True,
)     
    return str(output_dir)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/convert")
def convert(payload: ConvertRequest):
    output_file = download_audio(payload.url)

    return {
        "status": "downloaded",
        "file": output_file,
    }
