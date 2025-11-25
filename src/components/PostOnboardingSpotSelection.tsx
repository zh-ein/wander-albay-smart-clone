import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PostOnboardingSpotSelectionProps {
  open: boolean;
  onComplete: () => void;
  userId: string;
  preferences: any;
}

interface TouristSpot {
  id: string;
  name: string;
  location: string;
  category: string[];
  description: string;
  image_url: string;
  rating: number;
  budget_level: string;
  accessibility_friendly: boolean;
  scenery_type: string[];
  is_hidden_gem: boolean;
}

export const PostOnboardingSpotSelection = ({
  open,
  onComplete,
  userId,
  preferences,
}: PostOnboardingSpotSelectionProps) => {
  const [loading, setLoading] = useState(false);
  const [spots, setSpots] = useState<TouristSpot[]>([]);
  const [selectedSpots, setSelectedSpots] = useState<Set<string>>(new Set());
  const [fetchingSpots, setFetchingSpots] = useState(true);

  useEffect(() => {
    if (open) {
      fetchRecommendedSpots();
    }
  }, [open, preferences]);

  const fetchRecommendedSpots = async () => {
    setFetchingSpots(true);
    try {
      const { data, error } = await supabase
        .from("tourist_spots")
        .select("*");

      if (error) throw error;

      // Score and rank spots based on preferences
      const scoredSpots = (data || []).map((spot: any) => {
        let score = 0;

        // Match district
        if (preferences.albayDistrict && preferences.albayDistrict !== "Any District") {
          if (spot.location?.includes(preferences.albayDistrict)) score += 3;
        }

        // Match activities/categories
        if (preferences.activities && spot.category) {
          const activityKeywords = preferences.activities.join(" ").toLowerCase();
          const spotCategories = spot.category.join(" ").toLowerCase();
          if (activityKeywords.includes("hiking") && spotCategories.includes("adventure")) score += 2;
          if (activityKeywords.includes("beach") && spotCategories.includes("beach")) score += 2;
          if (activityKeywords.includes("food") && spotCategories.includes("food")) score += 2;
        }

        // Match scenery preference
        if (preferences.sceneryPreference && spot.scenery_type) {
          const sceneryMatch = spot.scenery_type.some((s: string) =>
            preferences.sceneryPreference.toLowerCase().includes(s.toLowerCase())
          );
          if (sceneryMatch) score += 2;
        }

        // Match budget
        if (preferences.budgetRange && spot.budget_level) {
          if (preferences.budgetRange.toLowerCase().includes(spot.budget_level.toLowerCase())) {
            score += 1;
          }
        }

        // Match place preference
        if (preferences.placePreference) {
          if (preferences.placePreference === "Hidden Gems" && spot.is_hidden_gem) score += 2;
          if (preferences.placePreference === "Popular Tourist Spots" && !spot.is_hidden_gem) score += 2;
          if (preferences.placePreference === "Both") score += 1;
        }

        // Match accessibility
        if (preferences.accessibilityNeeded && spot.accessibility_friendly) {
          score += 2;
        }

        return { ...spot, score };
      });

      // Sort by score and take top 12
      const topSpots = scoredSpots
        .sort((a, b) => b.score - a.score)
        .slice(0, 12) as TouristSpot[];

      setSpots(topSpots);
    } catch (error) {
      console.error("Error fetching spots:", error);
      toast.error("Failed to fetch recommended spots");
    } finally {
      setFetchingSpots(false);
    }
  };

  const handleAutoSelect = () => {
    // Auto-select top 6 spots
    const topSix = spots.slice(0, 6).map(spot => spot.id);
    setSelectedSpots(new Set(topSix));
    toast.success("Auto-selected top 6 recommended spots!");
  };

  const toggleSpot = (spotId: string) => {
    const newSelected = new Set(selectedSpots);
    if (newSelected.has(spotId)) {
      newSelected.delete(spotId);
    } else {
      newSelected.add(spotId);
    }
    setSelectedSpots(newSelected);
  };

  const handleCreateItinerary = async () => {
    if (selectedSpots.size === 0) {
      toast.error("Please select at least one spot");
      return;
    }

    setLoading(true);
    try {
      // Get full spot data for selected spots
      const selectedSpotsData = spots.filter(spot => selectedSpots.has(spot.id));
      
      // Create itinerary with selected spots
      const { error } = await supabase
        .from("itineraries")
        .insert([{
          user_id: userId,
          name: "My Personalized Itinerary",
          spots: selectedSpotsData as any,
          selected_categories: [...new Set(selectedSpotsData.flatMap(s => s.category))],
        }]);

      if (error) throw error;

      toast.success(`Created itinerary with ${selectedSpots.size} spots!`);
      onComplete();
    } catch (error) {
      console.error("Error creating itinerary:", error);
      toast.error("Failed to create itinerary");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Your Personalized Spots
          </DialogTitle>
          <DialogDescription>
            Based on your preferences, we've found these amazing destinations for you. 
            Select the ones you'd like to add to your itinerary, or let us auto-select the top recommendations.
          </DialogDescription>
        </DialogHeader>

        {fetchingSpots ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <Button onClick={handleAutoSelect} variant="outline" className="gap-2">
                <Sparkles className="w-4 h-4" />
                Auto-select Top 6
              </Button>
              <div className="flex-1" />
              <Badge variant="secondary" className="text-sm">
                {selectedSpots.size} selected
              </Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-4 py-4">
              {spots.map((spot) => (
                <Card
                  key={spot.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedSpots.has(spot.id) ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => toggleSpot(spot.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="flex items-start">
                        <Checkbox
                          checked={selectedSpots.has(spot.id)}
                          onCheckedChange={() => toggleSpot(spot.id)}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        {spot.image_url && (
                          <img
                            src={spot.image_url}
                            alt={spot.name}
                            className="w-full h-32 object-cover rounded-md mb-3"
                          />
                        )}
                        <h3 className="font-semibold text-lg mb-1 truncate">{spot.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{spot.location}</span>
                        </div>
                        {spot.rating > 0 && (
                          <div className="flex items-center gap-1 mb-2">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm">{spot.rating.toFixed(1)}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {spot.category?.slice(0, 2).map((cat) => (
                            <Badge key={cat} variant="secondary" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                          {spot.is_hidden_gem && (
                            <Badge variant="outline" className="text-xs">
                              Hidden Gem
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {spot.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between gap-4 pt-4 border-t">
              <Button variant="outline" onClick={handleSkip} disabled={loading}>
                Skip for Now
              </Button>
              <Button onClick={handleCreateItinerary} disabled={loading || selectedSpots.size === 0}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Itinerary with {selectedSpots.size > 0 ? `${selectedSpots.size} spots` : ""}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
