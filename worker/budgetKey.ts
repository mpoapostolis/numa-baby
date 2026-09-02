// Behind mobile NAT a whole carrier shares one IPv4 address; on IPv6 one
// household owns 2^64 of them, and a rate budget per full address was a
// budget per guess. Budget at the size that stands for one connection: the
// whole v4 address, the first 64 bits of v6.
export function budgetKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  // The first four hextets, with "::" expanded first: "2001:db8::a:b:c:d"
  // is 2001:db8:0:0/64, and splitting the text as written would have keyed
  // it on the fifth hextet instead — one /64 per guess.
  const [head] = ip.split("::");
  const groups = head ? head.split(":") : [];
  while (groups.length < 4) groups.push("0");
  return groups.slice(0, 4).map((group) => group.padStart(4, "0")).join(":");
}
