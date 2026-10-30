from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import subprocess
import uuid
import re
import threading

jobs = {}

class ConvertRequest(BaseModel):
    url: str
    title: str
    skipDuplicates: bool
    outputPath:str

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
    ],
    allow_methods=["*"],
    allow_headers=["*"]
)

def download_audio(url:str,skip_duplicates:bool,output_path: str,job_id:str,) -> str:

    if not url:
        raise ValueError("Missing URL")
    output_dir = Path(output_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_template = output_dir / "%(title)s.%(ext)s"

    command = [
        "yt-dlp",
        "--newline",
        "-f",
        "bestaudio/best",
        "-o",
        str(output_template),
    ]

    if skip_duplicates:
        command.append("--no-overwrites")

    command.append(url)

    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        )
    for line in process.stdout:
        match = re.search(r"(\d+(?:\.\d+)?)%", line)

        if match:
            jobs[job_id]["progress"] = float(match.group(1))

    if process.wait() == 0:
        jobs[job_id]["status"] = "complete"
        jobs[job_id]["progress"] = 100
        print("download completed succesfully yay!")

    else:
        jobs[job_id]["status"] = "failed"

    return str(output_dir)
    
@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/convert")
def convert(payload: ConvertRequest):
    job_id = str(uuid.uuid4())

    jobs[job_id]= {
        "status": "downloading",
        "progress": 0,
        "output_path": payload.outputPath
    }
    thread = threading.Thread(
        target = download_audio,
        args=(
            payload.url,
            payload.skipDuplicates,
            payload.outputPath,
            job_id,
        ),
        daemon = True,
    )
    thread.start()

    return {
        "jobid": job_id,
    } 

@app.get("/progress/{job_id}")
def get_progress(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Download job not found")
    
    return jobs[job_id]

@app.post("/open-folder/{job_id}")
def open_folder(job_id):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Download job not found")
    
    subprocess.Popen(["explorer", jobs[job_id]["output_path"]])

    return {"status": "opened"}


