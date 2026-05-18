import { BaseSourceScraper } from '../core/base-scraper';
import type {
  RawJob,
  ScrapeDetailInput,
  ScrapeListingInput,
  ScrapeListingResult,
  ScraperContext,
} from '../core/types';

const PAGE_SIZE = 10;

export class IndeedScraper extends BaseSourceScraper {
  readonly platform = 'INDEED' as const;
  readonly displayName = 'Indeed';
  readonly baseUrl = 'https://www.indeed.com';
  readonly defaultRateLimitPerMin = 12;

  protected async scrapeListing(
    { page }: ScraperContext,
    input: ScrapeListingInput,
  ): Promise<ScrapeListingResult> {
    const pageNum = input.page ?? 1;
    const start = (pageNum - 1) * PAGE_SIZE;
    const params = new URLSearchParams({
      q: input.query ?? '',
      l: input.location ?? '',
      start: String(start),
    });
    const url = `https://www.indeed.com/jobs?${params}`;

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const jobUrls = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll<HTMLAnchorElement>('a[data-jk], a.jcs-JobTitle').forEach((a) => {
        const jk = a.getAttribute('data-jk') ?? new URL(a.href).searchParams.get('jk');
        if (jk) out.push(`https://www.indeed.com/viewjob?jk=${jk}`);
      });
      return Array.from(new Set(out));
    });

    const nextPage = jobUrls.length === PAGE_SIZE && pageNum < input.maxPages ? pageNum + 1 : null;
    return { jobUrls, nextPage, pageNumber: pageNum };
  }

  protected async scrapeDetail(
    { page }: ScraperContext,
    { url }: ScrapeDetailInput,
  ): Promise<RawJob> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page
      .waitForSelector('[data-testid="jobsearch-JobInfoHeader-title"], h1', { timeout: 10_000 })
      .catch(() => undefined);

    const data = await page.evaluate(() => {
      const text = (sel: string): string | null =>
        document.querySelector(sel)?.textContent?.trim() ?? null;
      return {
        title:
          text('[data-testid="jobsearch-JobInfoHeader-title"]') ??
          text('h1.jobsearch-JobInfoHeader-title') ??
          text('h1'),
        company:
          text('[data-testid="inlineHeader-companyName"]') ??
          text('[data-company-name="true"]') ??
          text('div.jobsearch-CompanyInfoContainer a'),
        location:
          text('[data-testid="job-location"]') ??
          text('[data-testid="inlineHeader-companyLocation"]'),
        description:
          (document.querySelector('#jobDescriptionText') as HTMLElement | null)?.innerText?.trim() ??
          null,
        salaryText:
          text('[data-testid="jobsearch-OtherJobDetailsContainer"] [aria-label*="Pay"]') ??
          text('span.salary-snippet'),
        postedAtText: text('[data-testid="myJobsStateDate"]') ?? text('.jobsearch-JobMetadataFooter'),
        remote: /remote/i.test(
          (document.querySelector('[data-testid="job-location"]') as HTMLElement | null)?.innerText ?? '',
        ),
      };
    });

    const externalId = new URL(url).searchParams.get('jk');
    if (!data.title) throw new Error('indeed: missing title');

    return {
      url,
      externalId,
      title: data.title,
      company: data.company ?? 'Unknown',
      location: data.location,
      description: data.description,
      applyUrl: url,
      postedAtText: data.postedAtText,
      salaryText: data.salaryText,
      skillsText: [],
      roleCategoryText: null,
      remote: data.remote,
    };
  }
}

export const indeedScraper = new IndeedScraper();
