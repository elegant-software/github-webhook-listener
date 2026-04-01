const { spawn } = require("node:child_process");

function runGhApi({ ghBin, args, input }) {
  return new Promise((resolve, reject) => {
    const child = spawn(ghBin, args, {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`gh api exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
    });

    child.stdin.end(input || "");
  });
}

async function resolveIssueFromNodeId({ ghBin, nodeId }) {
  const query = [
    "query($id: ID!) {",
    "  node(id: $id) {",
    "    __typename",
    "    ... on Issue {",
    "      number",
    "      title",
    "      url",
    "      repository {",
    "        name",
    "        nameWithOwner",
    "      }",
    "    }",
    "  }",
    "}"
  ].join("\n");

  const { stdout } = await runGhApi({
    ghBin,
    args: ["api", "graphql", "-f", `query=${query}`, "-F", `id=${nodeId}`]
  });

  let parsed;
  try {
    parsed = JSON.parse(stdout || "{}");
  } catch (error) {
    throw new Error("GitHub GraphQL response was not valid JSON");
  }

  const node = parsed?.data?.node;
  if (!node) {
    throw new Error("GitHub GraphQL response did not include a node");
  }

  if (node.__typename !== "Issue") {
    throw new Error(`GitHub node ${nodeId} resolved to ${node.__typename || "unknown"} instead of Issue`);
  }

  const issueNumber = node.number;
  const repositoryName = node.repository?.name;
  const repositoryNameWithOwner = node.repository?.nameWithOwner;

  if (!issueNumber || !repositoryName || !repositoryNameWithOwner) {
    throw new Error("GitHub GraphQL response did not include issue repository details");
  }

  return {
    issueNumber,
    repositoryName,
    repositoryNameWithOwner,
    title: node.title,
    url: node.url
  };
}

async function dispatchProjectStatusChange({ ghBin, eventType, repositoryNameWithOwner, issueNumber, projectStatus }) {
  const endpoint = `repos/${repositoryNameWithOwner}/dispatches`;
  const payload = {
    event_type: eventType,
    client_payload: {
      issue_number: issueNumber,
      project_status: projectStatus,
      target_repo: repositoryNameWithOwner
    }
  };

  await runGhApi({
    ghBin,
    args: ["api", endpoint, "-X", "POST", "--input", "-"],
    input: JSON.stringify(payload)
  });

  return {
    endpoint,
    payload
  };
}

module.exports = {
  dispatchProjectStatusChange,
  resolveIssueFromNodeId
};
