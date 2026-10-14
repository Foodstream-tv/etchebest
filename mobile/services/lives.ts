import { request, seg } from './http';

export type LiveStatus = 'scheduled' | 'live' | 'ended';
export type LiveStatusFilter = 'all' | LiveStatus;

export type LiveTag = {
  id: number;
  name: string;
  slug: string;
};

export type LiveUser = {
  id: string;
  username?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
};

export type LiveDTO = {
  id: number;
  room_id: string;
  title: string;
  description?: string;
  dish_name?: string;
  status: LiveStatus;
  scheduled_at?: string;
  created_at: string;
  thumbnail_url?: string;
  preview_gif?: string;
  current_viewers: number;
  view_count: number;
  tags?: LiveTag[];
  user?: LiveUser;
  replay_url?: string;
  has_replay?: boolean;
};

export type LivesPage = {
  lives: LiveDTO[];
  total: number;
  page: number;
  limit: number;
};

export type GetLivesParams = {
  q?: string;
  /** One tag, or several (a live matches when it has any of them) */
  tag?: string | readonly string[];
  status?: LiveStatusFilter;
  page?: number;
  limit?: number;
};

/** "Tout"/"All" is the "no filter" tag on both clients. */
const isAllTag = (tag: string) => tag === 'Tout' || tag === 'All';

export function normalizeTags(tag: GetLivesParams['tag']): string[] {
  const list = Array.isArray(tag) ? tag : tag ? [tag as string] : [];
  return list.map((item) => item.trim()).filter((item) => item && !isAllTag(item));
}

/** Public endpoint: works signed out; the token is sent when there is one. */
export async function getLives(params: GetLivesParams = {}): Promise<LivesPage> {
  const page = await request<Partial<LivesPage> | null>('/lives', {
    auth: 'optional',
    query: {
      q: params.q?.trim(),
      tag: normalizeTags(params.tag),
      status: params.status && params.status !== 'all' ? params.status : undefined,
      page: params.page,
      limit: params.limit,
    },
  });

  return {
    lives: Array.isArray(page?.lives) ? page.lives : [],
    total: page?.total ?? 0,
    page: page?.page ?? params.page ?? 1,
    limit: page?.limit ?? params.limit ?? 0,
  };
}

export async function getLiveByRoomId(roomId: string): Promise<LiveDTO> {
  return request<LiveDTO>(`/lives/${seg(roomId)}`, { auth: 'optional' });
}

/** Recipe is embedded in the description after this marker (see web watch page). */
export const RECIPE_MARKER = '---FOODSTREAM_RECIPE---';

export type ParsedDescription = {
  description: string;
  recipe: unknown | null;
};

export function parseLiveDescription(raw: string | undefined | null): ParsedDescription {
  const value = raw ?? '';
  if (!value.includes(RECIPE_MARKER)) {
    return { description: value, recipe: null };
  }

  const [descriptionPart, ...rest] = value.split(RECIPE_MARKER);
  try {
    return { description: descriptionPart.trim(), recipe: JSON.parse(rest.join(RECIPE_MARKER).trim()) };
  } catch {
    return { description: descriptionPart.trim(), recipe: null };
  }
}

export function liveHostImage(live: Pick<LiveDTO, 'user'>): string | undefined {
  return live.user?.profileImageUrl || live.user?.profile_image_url || undefined;
}
