import { Mic } from "lucide-react";

type Person = Readonly<{
  label: string;
  skin: string;
  apron: string;
}>;

// Generic, original chef avatars: they only suggest "two people cooking together".
function ChefAvatar({ skin, apron }: Pick<Person, "skin" | "apron">) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      {/* shoulders + apron */}
      <path d="M12 100c2-24 18-36 38-36s36 12 38 36z" fill="#efe6d8" />
      <path d="M34 100c1-16 7-26 16-26s15 10 16 26z" fill={apron} />
      {/* neck + head */}
      <rect x="43" y="52" width="14" height="14" rx="6" fill={skin} />
      <circle cx="50" cy="42" r="17" fill={skin} />
      {/* toque */}
      <path
        d="M31 33c-6-1-9-7-6-12 3-5 9-5 12-2 2-5 9-7 13-3 4-4 11-2 13 3 3-3 9-3 12 2 3 5 0 11-6 12v6H31z"
        fill="#fbf7f0"
        stroke="#d9ccb6"
        strokeWidth="1.5"
      />
      <rect x="31" y="31" width="38" height="5" fill="#e9e0d1" />
      {/* face */}
      <circle cx="43.5" cy="44" r="1.8" fill="#2b1a10" />
      <circle cx="56.5" cy="44" r="1.8" fill="#2b1a10" />
      <path d="M44 50.5c3 3 9 3 12 0" stroke="#2b1a10" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

type AuthRoomAvatarsProps = Readonly<{
  chefLabel: string;
  guestLabel: string;
}>;

// The two other people of a cooking room, stacked next to the live preview.
export default function AuthRoomAvatars({ chefLabel, guestLabel }: AuthRoomAvatarsProps) {
  const people: Person[] = [
    { label: chefLabel, skin: "#f1c7a0", apron: "#ff7a1a" },
    { label: guestLabel, skin: "#9a6240", apron: "#3b2a1d" },
  ];

  return (
    <ul aria-hidden="true" className="flex w-32 shrink-0 flex-col gap-3 xl:w-44">
      {people.map((p) => (
        <li
          key={p.label}
          className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-[radial-gradient(120%_100%_at_50%_0%,#fbf0df_0%,#f1e1c8_100%)] dark:bg-[radial-gradient(120%_100%_at_50%_0%,#4a2f1b_0%,#2a1b11_85%)]"
        >
          <div className="absolute inset-x-3 bottom-0 top-2">
            <ChefAvatar skin={p.skin} apron={p.apron} />
          </div>
          <span className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-[#f5ede0] backdrop-blur-sm">
            <Mic className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{p.label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
