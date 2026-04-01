function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readPath(source, path) {
  let current = source;
  for (const segment of path) {
    if (!isObject(current) && !Array.isArray(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function firstDefined(source, candidatePaths) {
  for (const path of candidatePaths) {
    const value = readPath(source, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function normalizeRepository(value) {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value.includes("/") ? value.split("/").pop() : value;
  }

  if (isObject(value)) {
    if (typeof value.full_name === "string") {
      return value.full_name.split("/").pop();
    }
    if (typeof value.name === "string") {
      return value.name;
    }
  }

  return undefined;
}

function normalizeRepositoryWithOwner(value) {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string" && value.includes("/")) {
    return value;
  }

  if (isObject(value) && typeof value.full_name === "string" && value.full_name.includes("/")) {
    return value.full_name;
  }

  return undefined;
}

function normalizeIssueNumber(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^[1-9][0-9]*$/.test(value)) {
    return Number(value);
  }

  return undefined;
}

function normalizeStatus(value) {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (isObject(value)) {
    if (typeof value.name === "string" && value.name.trim()) {
      return value.name.trim();
    }
    if (typeof value.value === "string" && value.value.trim()) {
      return value.value.trim();
    }
  }

  return undefined;
}

function extractTargetRepository(payload) {
  const candidate = firstDefined(payload, [
    ["target_repo"],
    ["client_payload", "target_repo"],
    ["content", "repository"],
    ["content", "repository", "full_name"],
    ["content", "repository", "name"],
    ["content", "issue", "repository"],
    ["content", "issue", "repository", "full_name"],
    ["content", "issue", "repository", "name"],
    ["item", "content", "repository"],
    ["item", "content", "repository", "full_name"],
    ["item", "content", "repository", "name"],
    ["repository"],
    ["repository", "full_name"],
    ["repository", "name"]
  ]);

  return normalizeRepository(candidate);
}

function extractTargetRepositoryWithOwner(payload) {
  const candidate = firstDefined(payload, [
    ["target_repo"],
    ["client_payload", "target_repo"],
    ["content", "repository", "full_name"],
    ["content", "issue", "repository", "full_name"],
    ["item", "content", "repository", "full_name"],
    ["repository", "full_name"]
  ]);

  return normalizeRepositoryWithOwner(candidate);
}

function extractIssueNumber(payload) {
  const candidate = firstDefined(payload, [
    ["issue_number"],
    ["client_payload", "issue_number"],
    ["content", "number"],
    ["content", "issue", "number"],
    ["item", "content", "number"],
    ["item", "content", "issue", "number"],
    ["projects_v2_item", "content", "number"]
  ]);

  return normalizeIssueNumber(candidate);
}

function extractProjectStatus(payload) {
  const candidate = firstDefined(payload, [
    ["project_status"],
    ["client_payload", "project_status"],
    ["changes", "field_value", "to", "name"],
    ["changes", "field_value", "to", "value"],
    ["field_value", "name"],
    ["field_value", "value"],
    ["projects_v2_item", "field_value", "name"],
    ["projects_v2_item", "field_value", "value"]
  ]);

  return normalizeStatus(candidate);
}

function extractContentNodeId(payload) {
  const candidate = firstDefined(payload, [
    ["content_node_id"],
    ["content", "node_id"],
    ["content", "id"],
    ["item", "content_node_id"],
    ["projects_v2_item", "content_node_id"]
  ]);

  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function extractContentType(payload) {
  const candidate = firstDefined(payload, [
    ["content_type"],
    ["content", "__typename"],
    ["item", "content_type"],
    ["projects_v2_item", "content_type"]
  ]);

  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function classifyWebhook(headers, payload) {
  const githubEvent = headers["x-github-event"];
  if (githubEvent !== "projects_v2_item") {
    return {
      status: "ignored",
      reason: `Unsupported GitHub event: ${githubEvent || "unknown"}`
    };
  }

  const action = payload.action;
  const projectStatus = extractProjectStatus(payload);
  if (!projectStatus) {
    return {
      status: "ignored",
      reason: action ? `No project status change found for action: ${action}` : "No project status change found"
    };
  }

  const issueNumber = extractIssueNumber(payload);
  const repositoryName = extractTargetRepository(payload);
  const repositoryNameWithOwner = extractTargetRepositoryWithOwner(payload);
  const contentNodeId = extractContentNodeId(payload);
  const contentType = extractContentType(payload);

  if (issueNumber && repositoryName) {
    return {
      status: "forward",
      action,
      issueNumber,
      projectStatus,
      repositoryName,
      repositoryNameWithOwner
    };
  }

  if (contentNodeId && contentType === "Issue") {
    return {
      status: "resolve",
      action,
      projectStatus,
      contentNodeId,
      contentType
    };
  }

  return {
    status: "rejected",
    action,
    reason: "Missing required issue number or target repository",
    details: {
      issueNumber,
      repositoryName,
      repositoryNameWithOwner,
      projectStatus,
      contentNodeId,
      contentType
    }
  };
}

module.exports = {
  classifyWebhook
};
