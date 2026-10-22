from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import subprocess

class ConvertRequest(BaseModel):
    url: str
    title: str
    skipDuplicates: bool

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
    ],
    allow_methods=["*"],
    allow_headers=["*"]
)

def download_audio(url:str, skip_duplicates:bool) -> str:
    if not url:
        raise ValueError("Missing URL")
    output_dir = Path(r"C:\Users\milto\Music\Beginning\converted")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_template = output_dir / "%(title)s.%(ext)s"

    command = [
        "yt-dlp",
        "-f",
        "bestaudio/best",
        "-o",
        str(output_template),
    ]

    if skip_duplicates:
        command.append("--no-overwrites")

    command.append(url)

    subprocess.run(command, check=True)
    return str(output_dir)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/convert")
def convert(payload: ConvertRequest):
    output_file = download_audio(payload.url, payload.skipDuplicates)

    return {
        "status": "downloaded",
        "file": output_file,
    }
