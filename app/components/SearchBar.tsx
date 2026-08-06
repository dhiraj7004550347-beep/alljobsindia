"use client";

import { useState } from "react";

type Props = {
  onSearch: (value: string) => void;
};

export default function SearchBar({ onSearch }: Props) {
  const [search, setSearch] = useState("");

  return (
    <div className="mb-8">
      <input
        type="text"
        placeholder="Search Jobs..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          onSearch(e.target.value);
        }}
        className="w-full border rounded-lg p-4 text-lg"
      />
    </div>
  );
}