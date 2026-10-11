import { Component, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

type SupportedProvider = 'soundcloud';

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

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadCurrentTab();
    this.checkBackend();
  }

  protected rip(): void {
    const url = this.currentUrl();
    const title = this.pageTitle();

    console.log('sending to backend:', {url,title});
    
    this.status.set('downloading');

    this.http.post('http://localhost:8000/convert', {
      url,
      title,
    }).subscribe({
      next: (response => {
        console.log('backend response:', response)
        this.status.set('ripped');
      }),
      error:(error) => {
        console.error('backend error:', error);
        this.status.set('idle');
      }
    })
  }

  protected cancel(): void {
    this.status.set('idle');
  }

  protected confirm(): void {
    console.log('confirmed rip');
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

  private loadCurrentTab(): void {
    if (!chrome?.tabs || !chrome?.scripting) {
      this.pageTitle.set('Chrome extension API unavailable');
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const tabId = tab.id;
      if (tabId === undefined) {
        this.pageTitle.set(tab.title ?? 'Untitled page');
        return;
      }

      if (tab.url) {
        this.currentUrl.set(tab.url);
        this.website.set(new URL(tab.url).hostname);
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

          this.pageTitle.set(domTitle || tab.title || 'Untitled page');
        },
      );
    });
  }
}
