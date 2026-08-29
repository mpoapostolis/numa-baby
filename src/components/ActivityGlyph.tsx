import { Droplet, Heart, Milk, Moon, Pill, Thermometer, Weight, Wind } from "lucide-react";
import { ActivityType } from "../domain/types";

export function ActivityGlyph({ type }: { type: ActivityType }) {
  if (type === "bottle") return <Milk size={19} strokeWidth={2.1} />;
  if (type === "nursing") return <Heart size={19} strokeWidth={2.1} />;
  if (type === "burp") return <Wind size={19} strokeWidth={2.1} />;
  if (type === "sleep") return <Moon size={19} strokeWidth={2.1} />;
  if (type === "growth") return <Weight size={19} strokeWidth={2.1} />;
  if (type === "health") return <Thermometer size={19} strokeWidth={2.1} />;
  if (type === "medicine") return <Pill size={19} strokeWidth={2.1} />;
  return <Droplet size={19} strokeWidth={2.1} />;
}
