import { BaseSourceScraper } from '../core/base-scraper';
import type {
  RawJob,
  ScrapeDetailInput,
  ScrapeListingInput,
  ScrapeListingResult,
  ScraperContext,
} from '../core/types';

export class WellfoundScraper extends BaseSourceScraper {
  readonly platform = 'WELLFOUND' as const;
  readonly displayName = 'Wellfound';
  readonly baseUrl = 'https://wellfound.com';
  readonly defaultRateLimitPerMin = 15;

  protected async scrapeListing(
    { page }: ScraperContext,
    input: ScrapeListingInput,
  ): Promise<ScrapeListingResult> {
    const pageNum = input.page ?? 1;
    const slug = (input.query ?? '').trim().toLowerCase().replace(/\s+/g, '-');
    const role = slug ? `role/${encodeURIComponent(slug)}/` : '';
    const loc = input.location ? `location/${encodeURIComponent(input.location.toLowerCase())}/` : '';
    const url = `https://wellfound.com/jobs/${role}${loc}?page=${pageNum}`;

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const jobUrls = await page.evaluate(() => {
      const out: string[] = [];
      document
        .querySelectorAll<HTMLAnchorElement>('a[href*="/jobs/"]')
        .forEach((a) => {
          if (/\/jobs\/\d+/.test(a.href)) out.push(a.href.split('?')[0]!);
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
    await page.waitForSelector('h1, [data-test="JobTitle"]', { timeout: 10_000 }).catch(() => undefined);

    const data = await page.evaluate(() => {
      const text = (sel: string): string | null =>
        document.querySelector(sel)?.textContent?.trim() ?? null;
      const skills = Array.from(
        document.querySelectorAll('[data-test="SkillTag"], .skill-tag'),
      )
        .map((n) => n.textContent?.trim() ?? '')
        .filter(Boolean);
      const ld = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'))
        .map((s) => {
          try {
            return JSON.parse(s.textContent ?? 'null');
          } catch {
            return null;
          }
        })
        .find((j) => j && j['@type'] === 'JobPosting');

      return {
        title: ld?.title ?? text('h1'),
        company: ld?.hiringOrganization?.name ?? text('[data-test="StartupName"]'),
        location: ld?.jobLocation?.address?.addressLocality ?? text('[data-test="LocationTag"]'),
        description:
          ld?.description ??
          (document.querySelector('[data-test="JobDescription"]') as HTMLElement | null)?.innerText?.trim() ??
          null,
        applyUrl: text('a[data-test="Apply"]') ?? location.href,
        postedAtText: ld?.datePosted ?? text('[data-test="PostedDate"]'),
        salaryText:
          (ld?.baseSalary &&
            `${ld.baseSalary.currency ?? ''} ${ld.baseSalary.value?.minValue ?? ''}-${ld.baseSalary.value?.maxValue ?? ''} ${ld.baseSalary.value?.unitText ?? ''}`) ||
          text('[data-test="Compensation"]'),
        skillsText: skills,
        remote: /remote/i.test(text('[data-test="LocationTag"]') ?? '' + (ld?.jobLocationType ?? '')),
      };
    });

    const externalId = url.match(/\/jobs\/(\d+)/)?.[1] ?? null;
    if (!data.title) throw new Error('wellfound: missing title');

    return {
      url,
      externalId,
      title: data.title,
      company: data.company ?? 'Unknown',
      location: data.location ?? null,
      description: data.description,
      applyUrl: data.applyUrl ?? url,
      postedAtText: data.postedAtText,
      salaryText: data.salaryText,
      skillsText: data.skillsText,
      roleCategoryText: null,
      remote: data.remote,
    };
  }
}

export const wellfoundScraper = new WellfoundScraper();
