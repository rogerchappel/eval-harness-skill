import yaml from "js-yaml";

export function yamlDump(value: unknown): string {
  return yaml.dump(value, { noRefs: true, lineWidth: -1 });
}
