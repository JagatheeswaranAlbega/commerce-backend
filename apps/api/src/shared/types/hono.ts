import type { Database, DatabaseHandle } from "@/db/client";
import type { AccessType, RequestAuthContext, UserRole } from "@/modules/auth/auth.types";
import type { CloudflareBindings } from "@/shared/types/cloudflare";

export type AppVariables = {
  requestId: string;
  db?: Database;
  dbHandle?: DatabaseHandle;
  auth?: RequestAuthContext;
  storeId?: string | null;
  role?: UserRole;
  accessType?: AccessType;
};

export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: AppVariables;
};
