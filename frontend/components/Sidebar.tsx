"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Droplet, Trees, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onLayerChange: (type: "water" | "forests" | "none" | "all") => void;
  currentLayer: "water" | "forests" | "none" | "all";
}

export function Sidebar({ onLayerChange, currentLayer }: SidebarProps) {
  const layers = [
    {
      id: "water",
      name: "Water Bodies",
      icon: Droplet,
      description: "Show water bodies and water features",
    },
    {
      id: "forests",
      name: "Forest Areas",
      icon: Trees,
      description: "Show forest coverage and vegetation",
    },
    {
      id: "all",
      name: "All Layers",
      icon: Layers,
      description: "Show all available layers",
    },
  ] as const;

  return (
    <div className="pb-12 w-64">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold">Layers</h2>
          <ScrollArea className="h-[300px] px-1">
            <div className="space-y-1">
              {layers.map((layer) => (
                <Button
                  key={layer.id}
                  onClick={() => onLayerChange(layer.id)}
                  variant={currentLayer === layer.id ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2",
                    currentLayer === layer.id && "bg-primary text-primary-foreground"
                  )}
                >
                  <layer.icon className="h-4 w-4" />
                  {layer.name}
                </Button>
              ))}
              <Separator className="my-2" />
              <Button
                onClick={() => onLayerChange("none")}
                variant={currentLayer === "none" ? "default" : "ghost"}
                className="w-full justify-start"
              >
                Clear All
              </Button>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}