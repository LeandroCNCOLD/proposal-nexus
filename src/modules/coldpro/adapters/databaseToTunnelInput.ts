import { formToTunnelInput } from "./formToTunnelInput";

export function databaseToTunnelInput(tunnel: Record<string, unknown>, environment?: Record<string, unknown> | null) {
  return formToTunnelInput(tunnel, environment);
}
