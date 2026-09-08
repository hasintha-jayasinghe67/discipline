"use client";

import FinderMenu from "./FinderMenu";
import { useFinder } from "@/lib/finderToggle";

export default function FinderMenuHost() {
  const { enabled } = useFinder();
  return <FinderMenu enabled={enabled} />;
}
