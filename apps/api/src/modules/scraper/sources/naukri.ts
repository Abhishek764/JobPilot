import { BaseSourceScraper } from '../core/base-scraper';
import type {
  RawJob,
  ScrapeDetailInput,
  ScrapeListingInput,
  ScrapeListingResult,
  ScraperContext,
} from '../core/types';

export class NaukriScraper extends BaseSourceScraper {
  readonly platform = 'NAUKRI' as const;
  readonly displayName = 'Naukri';
  readonly baseUrl = 'https://www.naukri.com';
  readonly defaultRateLimitPerMin = 15;

  protected async scrapeListing(
    { page }: ScraperContext,
    input: ScrapeListingInput,
  ): Promise<ScrapeListingResult> {
    const pageNum = input.page ?? 1;
    const querySlug = (input.query ?? '').trim().toLowerCase().replace(/\s+/g, '-');
    const locSlug = (input.location ?? '').trim().toLowerCase().replace(/\s+/g, '-');
    const segments = [
      querySlug ? `${querySlug}-jobs` : 'jobs',
      locSlug ? `in-${locSlug}` : '',
    ].filter(Boolean);
    const url = `https://www.naukri.com/${segments.join('-')}-${pageNum}`;

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const jobUrls = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll<HTMLAnchorElement>('a.title, a.jobTitle').forEach((a) => {
        if (a.href.includes('/job-listings-')) out.push(a.href.split('?')[0]!);
      });
      return Array.from(new Set(out));
    });

    const nextPage = jobUrls.length > 0 && pageNum < input.maxPages ? pageNum + 1 : null;
    return { jobUrls, nextPage, pageNumber: pageNum };
  }

  protected async scrapeDetail(
    { page }: ScraperContext,
    { url }: ScrapeDetailInput,
  ): Promise<RawJob> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page
      .waitForSelector('.styles_jd-header-title__rZwM1, h1', { timeout: 10_000 })
      .catch(() => undefined);

    const data = await page.evaluate(() => {
      const text = (sel: string): string | null =>
        document.querySelector(sel)?.textContent?.trim() ?? null;
      const skills = Array.from(document.querySelectorAll('.styles_key-skill__GIPn_ a, .key-skill a'))
        .map((n) => n.textContent?.trim() ?? '')
        .filter(Boolean);

      return {
        title: text('.styles_jd-header-title__rZwM1') ?? text('h1.jd-header-title') ?? text('h1'),
        company:
          text('.styles_jd-header-comp-name__MvqAI a') ??
          text('.jd-header-comp-name a') ??
          text('.companyname'),
        location:
          text('.styles_jhc__location__W_pVs a') ??
          text('.location') ??
          text('.loc'),
        description:
          (document.querySelector('.styles_JDC__dang-inner-html__h0K4t') as HTMLElement | null)?.innerText?.trim() ??
          (document.querySelector('.dang-inner-html') as HTMLElement | null)?.innerText?.trim() ??
          null,
        salaryText: text('.styles_jhc__salary__jdfEC') ?? text('.salary'),
        postedAtText: text('.styles_jhc__stat__PgY67') ?? text('.stat-text'),
        skillsText: skills,
        remote: /remote|work\s+from\s+home/i.test(text('.styles_jhc__location__W_pVs') ?? ''),
      };
    });

    const externalId = url.match(/-(\d{6,})(?:\/|\?|$)/)?.[1] ?? null;
    if (!data.title) throw new Error('naukri: missing title');

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
      skillsText: data.skillsText,
      roleCategoryText: null,
      remote: data.remote,
    };
  }
}

export const naukriScraper = new NaukriScraper();
