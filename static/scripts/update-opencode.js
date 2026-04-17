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

    const downloads = {
      windows: {
        "x86-64": getAssetUrl(assets, "opencode-windows-x64.zip"),
        arm64: getAssetUrl(assets, "opencode-windows-arm64.zip"),
      },
      macos: {
        "x86-64": getAssetUrl(assets, "opencode-darwin-x64.zip"),
        arm64: getAssetUrl(assets, "opencode-darwin-arm64.zip"),
      },
      unix: {
        "x86-64": getAssetUrl(assets, "opencode-linux-x64.tar.gz"),
        arm64: getAssetUrl(assets, "opencode-linux-arm64.tar.gz"),
      },
    };

    let repoData = {
      softwareRepoDefinitionVersion: "1.0.0",
      repoName: "opencode",
      repoDescription: "opencode software repository",
      repoSoftware: [
        {
          id: "opencode",
          name: "opencode",
          developerName: "anomalyco",
          description: "Interactive CLI tool",
          iconUrl: "",
          sourceUrl: "https://github.com/anomalyco/opencode",
          latestReleaseVersion: version,
          releases: [],
        },
      ],
    };

    if (existsSync(JSON_FILE_PATH)) {
      repoData = JSON.parse(readFileSync(JSON_FILE_PATH, "utf8"));
    }

    const software = repoData.repoSoftware.find((s) => s.id === "opencode");

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

      software.latestReleaseVersion = version;

      // Ensure directory exists before writing
      const dir = JSON_FILE_PATH.substring(0, JSON_FILE_PATH.lastIndexOf("/"));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
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
