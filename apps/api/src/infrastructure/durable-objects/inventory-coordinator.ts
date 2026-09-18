/**
 * Per-variant inventory Durable Object.
 * Identity: inventory:{storeId|global}:{variantId}
 *
 * Cloudflare queues requests to a single DO instance, which serializes coordination.
 * Active reservation metadata is persisted in DO storage; PostgreSQL remains authoritative.
 */
type DoStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
};

type DoState = {
  storage: DoStorage;
};

export class InventoryCoordinator {
  private readonly state: DoState;

  constructor(state: DoState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/coordinate" && request.method === "POST") {
      await this.state.storage.put("lastCoordinatedAt", Date.now());
      return Response.json({ ok: true });
    }

    if (url.pathname === "/reservations" && request.method === "POST") {
      const body = (await request.json()) as {
        reference?: string;
        quantity?: number;
        action?: "set" | "clear";
      };
      const reservations =
        (await this.state.storage.get<Record<string, number>>("reservations")) ?? {};

      if (body.action === "clear" && body.reference) {
        delete reservations[body.reference];
      } else if (body.reference && typeof body.quantity === "number") {
        reservations[body.reference] = body.quantity;
      }

      await this.state.storage.put("reservations", reservations);
      return Response.json({ ok: true, reservations });
    }

    if (url.pathname === "/reservations" && request.method === "GET") {
      const reservations =
        (await this.state.storage.get<Record<string, number>>("reservations")) ?? {};
      return Response.json({ reservations });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
