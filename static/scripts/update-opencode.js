#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { get } from "https";

const REPO_URL =
  "https://api.github.com/repos/anomalyco/opencode/releases/latest";

const JSON_FILE_PATH = "repos/opencode/software-repo.json";

async function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    get(
      REPO_URL,
      {
        headers: { "User-Agent": "opencode-software-repo-sync" },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () => resolve(JSON.parse(data)));
      },
    ).on("error", reject);
  });
}

function getAssetUrl(assets, pattern) {
  const asset = assets.find((tmpAsset) => tmpAsset.name === pattern);

  return asset ? asset.browser_download_url : null;
}

async function run() {
  try {
    const release = await fetchLatestRelease();

    const version = release.tag_name;
    const timestamp = release.published_at;
    const assets = release.assets;

    const downloads = {};

    const platformConfigs = {
      windows: {
        "x86-64": "opencode-windows-x64.zip",
        arm64: "opencode-windows-arm64.zip",
      },
      macos: {
        "x86-64": "opencode-darwin-x64.zip",
        arm64: "opencode-darwin-arm64.zip",
      },
      unix: {
        "x86-64": "opencode-linux-x64.tar.gz",
        arm64: "opencode-linux-arm64.tar.gz",
      },
    };

    for (const [platform, archs] of Object.entries(platformConfigs)) {
      const platformDownloads = {};

      for (const [arch, pattern] of Object.entries(archs)) {
        const url = getAssetUrl(assets, pattern);

        if (url) {
          platformDownloads[arch] = url;
        }
      }

      if (Object.keys(platformDownloads).length > 0) {
        downloads[platform] = platformDownloads;
      }
    }

    let repoData = {
      softwareRepoDefinitionVersion: "1.0.0",
      repoName: "OpenCode",
      repoDescription: "OpenCode software repository",
      repoSoftware: [
        {
          id: "opencode-cli",
          name: "OpenCode CLI",
          developerName: "Anomaly Innovations Inc.",
          description: "Interactive agentic LLM-CLI tool",
          sourceUrl: "https://github.com/anomalyco/opencode",
          optionalLatestReleaseVersion: version,
          releases: [],
        },
      ],
    };

    if (existsSync(JSON_FILE_PATH)) {
      repoData = JSON.parse(readFileSync(JSON_FILE_PATH, "utf8"));
    }

    const software = repoData.repoSoftware.find(
      (tmpSoftware) => tmpSoftware.id === "opencode",
    );

    if (!software) {
      throw new Error("opencode software definition not found.");
    }

    const existingRelease = software.releases.find(
      (tmpRelease) => tmpRelease.version === version,
    );

    if (!existingRelease) {
      software.releases.push({
        version: version,
        releaseTimestamp: timestamp,
        downloads: downloads,
      });

      software.optionalLatestReleaseVersion = version;

      // Ensure directory exists before writing.
      const targetDirectory = JSON_FILE_PATH.substring(
        0,
        JSON_FILE_PATH.lastIndexOf("/"),
      );

      if (!existsSync(targetDirectory)) {
        mkdirSync(targetDirectory, { recursive: true });
      }

      writeFileSync(JSON_FILE_PATH, JSON.stringify(repoData, null, 2));

      console.log(`Updated to version ${version}`);
    } else {
      console.log(
        `Version ${version} already exists in the software repo. Skip update.`,
      );
    }
  } catch (error) {
    console.error("Error updating software repo:", error);

    process.exit(1);
  }
}

run();
