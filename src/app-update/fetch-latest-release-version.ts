import { GITHUB_LATEST_RELEASE_API_URL } from './github-repo';
import { normalizeVersion } from './compare-versions';

type GitHubLatestRelease = {
  tag_name?: unknown;
};

export async function fetchLatestReleaseVersion(): Promise<string | null> {
  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'weigh-way-app',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GitHubLatestRelease;
    if (typeof data.tag_name !== 'string' || data.tag_name.length === 0) {
      return null;
    }

    return normalizeVersion(data.tag_name);
  } catch {
    return null;
  }
}
