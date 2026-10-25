import { Component, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

type SupportedProvider = 'soundcloud';
type Page = 'main' | 'settings';

function detectProvider(url: string): SupportedProvider | null {
  const hostname = new URL(url).hostname.replace(/^www\./, '');
  if (hostname === 'soundcloud.com') {
    return 'soundcloud';
  }

  return null;
}
@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly pageTitle = signal('No page detected');
  protected readonly website = signal('Unknown');
  protected readonly status = signal<'idle' | 'downloading' | 'ripped'>('idle');
  protected readonly backendStatus = signal<'checking' | 'online' | 'offline'>('checking');
  protected readonly currentUrl = signal<string | null>(null);
  protected readonly provider = signal<SupportedProvider | null>(null);
  protected readonly canDownload = signal(false);
  protected readonly currentPage = signal<Page>('main');
  protected readonly outputPath = signal('C:\\Users\\milto\\Music\\Beginning\\converted');
  protected readonly isEditingPath = signal(false);
  protected readonly draftPath = signal('C:\\Users\\milto\\Music\\Beginning\\converted');
  protected readonly skipDuplicates = signal(true);
  protected readonly downloadProgress = signal(0);

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadCurrentTab();
    this.checkBackend();
  }

  protected rip(): void {
    const url = this.currentUrl();
    const title = this.pageTitle();
    const skipDuplicates = this.skipDuplicates();
    const outputPath = this.outputPath();

    console.log('sending to backend:', { url, title });

    this.status.set('downloading');

    this.http
      .post<{ jobid: string }>('http://localhost:8000/convert', {
        url,
        title,
        skipDuplicates,
        outputPath,
      })
      .subscribe({
        next: (response) => {
          console.log('backend response:', response);
          const jobId = response.jobid;
          this.pollProgress(jobId);
        },
        error: (error) => {
          console.error('backend error:', error);
          this.status.set('idle');
        },
      });

    this.downloadProgress.set(0);
    this.status.set('downloading');
  }

  protected cancel(): void {
    this.status.set('idle');
  }

  protected confirm(): void {
    console.log('confirmed rip');
  }

  private loadCurrentTab(): void {
    if (!chrome?.tabs || !chrome?.scripting) {
      this.pageTitle.set('Chrome extension API unavailable');
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab.url) {
        this.currentUrl.set(tab.url);
        this.website.set(new URL(tab.url).hostname);

        const detectedProvider = detectProvider(tab.url);
        this.provider.set(detectedProvider);
      }
      const tabId = tab.id;
      if (tabId === undefined) {
        this.pageTitle.set(tab.title ?? 'Untitled page');
        return;
      }

      chrome.scripting.executeScript(
        {
          target: {
            tabId,
            allFrames: true,
          },
          func: () => {
            const element = document.querySelector('section[aria-label="Track header"] h1');

            return {
              found: element !== null,
              text: element?.textContent?.trim() ?? null,
              url: location.href,
            };
          },
        },
        (results) => {
          console.log('results:', results);
          const match = results.find((r) => r.result?.text);
          const domTitle = match?.result?.text;
          console.log('domTitle', domTitle);

          this.canDownload.set(Boolean(domTitle));
          if (domTitle) {
            this.pageTitle.set(domTitle);
          } else if (
            tab.title === 'Discover the top streamed music and songs online on Soundcloud'
          ) {
            this.pageTitle.set('Select a song and start rippin');
          } else {
            this.pageTitle.set(tab.title ?? 'Untitled page');
          }
        },
      );
    });
  }
  protected openSettings(): void {
    this.currentPage.set('settings');
    console.log(this.currentPage());
  }

  protected backToMain(): void {
    this.currentPage.set('main');
  }

  protected startEditingPath(): void {
    this.draftPath.set(this.outputPath());
    this.isEditingPath.set(true);
  }

  protected stopEditingPath(): void {
    this.isEditingPath.set(false);
  }

  protected savePath(): void {
    this.outputPath.set(this.draftPath());
    this.isEditingPath.set(false);
  }

  protected updateDraftPath(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.draftPath.set(input.value);
  }

  protected updateDuplicateCheck(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.skipDuplicates.set(input.checked);
  }

  protected pollProgress(jobId: string): void {
    this.http
      .get<{ progress: number; status: string }>(`http://localhost:8000/progress/${jobId}`)
      .subscribe({
        next: (response) => {
          this.downloadProgress.set(response.progress);

          if (response.status === 'complete') {
            this.status.set('ripped');
            console.log('download is finished yay');
          } else if (response.status === 'failed') {
            this.status.set('idle');
          } else {
            setTimeout(() => this.pollProgress(jobId), 500);
          }
        },
        error: (error) => {
          console.error('progress error:', error);
          this.status.set('idle');
        },
      });
  }

  private checkBackend(): void {
    this.http.get<{ status: string }>('http://localhost:8000/health').subscribe({
      next: () => {
        this.backendStatus.set('online');
      },
      error: () => {
        this.backendStatus.set('offline');
      },
    });
  }

  protected openFolder(jobId: string): void {
    this.http.post<{ status: string }>('http://localhost:8000/open-folder/${jobId}', {}).subscribe({
      next: () => {
        console.log('opened folder');
      },
      error: (error) => {
        console.error("could not open folder:", error);
      },
    });
  }
}
