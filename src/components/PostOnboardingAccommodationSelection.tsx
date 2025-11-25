import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Hotel, MapPin, Star, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PostOnboardingAccommodationSelectionProps {
  open: boolean;
  onComplete: () => void;
  userId: string;
  preferences: any;
}

interface Accommodation {
  id: string;
  name: string;
  location: string;
  category: string[];
  description: string;
  image_url: string;
  rating: number;
  price_range: string;
  amenities: string[];
  municipality: string;
}

export const PostOnboardingAccommodationSelection = ({
  open,
  onComplete,
  userId,
  preferences,
}: PostOnboardingAccommodationSelectionProps) => {
  const [loading, setLoading] = useState(false);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [selectedAccommodations, setSelectedAccommodations] = useState<Set<string>>(new Set());
  const [fetchingAccommodations, setFetchingAccommodations] = useState(true);

  useEffect(() => {
    if (open) {
      fetchRecommendedAccommodations();
    }
  }, [open, preferences]);

  const fetchRecommendedAccommodations = async () => {
    setFetchingAccommodations(true);
    try {
      const { data, error } = await supabase
        .from("accommodations")
        .select("*");

      if (error) throw error;

      // Score and rank accommodations based on preferences
      const scoredAccommodations = (data || []).map((accommodation: any) => {
        let score = 0;

        // Match district
        if (preferences.albayDistrict && preferences.albayDistrict !== "Any District") {
          if (accommodation.location?.includes(preferences.albayDistrict) || 
              accommodation.municipality?.includes(preferences.albayDistrict)) {
            score += 3;
          }
        }

        // Match budget preference
        if (preferences.budgetRange && accommodation.price_range) {
          const budgetMap: { [key: string]: string[] } = {
            "Budget-friendly": ["Budget", "₱"],
            "Moderate": ["Mid-range", "₱₱", "Moderate"],
            "Premium": ["Luxury", "₱₱₱", "Premium"],
          };
          
          const matchingRanges = budgetMap[preferences.budgetRange] || [];
          if (matchingRanges.some(range => accommodation.price_range.includes(range))) {
            score += 3;
          }
        }

        // Match traveler type with accommodation category
        if (preferences.travelerType && accommodation.category) {
          const categoryString = accommodation.category.join(" ").toLowerCase();
          if (preferences.travelerType.includes("Relaxed") && categoryString.includes("resort")) score += 2;
          if (preferences.travelerType.includes("Adventure") && categoryString.includes("hostel")) score += 2;
          if (preferences.travelerType.includes("Family") && categoryString.includes("hotel")) score += 2;
        }

        // Match travel companions
        if (preferences.travelCompanions && accommodation.amenities) {
          const amenitiesString = accommodation.amenities.join(" ").toLowerCase();
          if (preferences.travelCompanions === "Family" && amenitiesString.includes("family")) score += 2;
          if (preferences.travelCompanions === "Couple" && amenitiesString.includes("romantic")) score += 1;
        }

        // Boost higher-rated accommodations
        if (accommodation.rating > 4) score += 1;
        if (accommodation.rating > 4.5) score += 1;

        return { ...accommodation, score };
      });

      // Sort by score and take top 10
      const topAccommodations = scoredAccommodations
        .sort((a, b) => b.score - a.score)
        .slice(0, 10) as Accommodation[];

      setAccommodations(topAccommodations);
    } catch (error) {
      console.error("Error fetching accommodations:", error);
      toast.error("Failed to fetch recommended accommodations");
    } finally {
      setFetchingAccommodations(false);
    }
  };

  const handleAutoSelect = () => {
    // Auto-select top 4 accommodations
    const topFour = accommodations.slice(0, 4).map(acc => acc.id);
    setSelectedAccommodations(new Set(topFour));
    toast.success("Auto-selected top 4 recommended accommodations!");
  };

  const toggleAccommodation = (accId: string) => {
    const newSelected = new Set(selectedAccommodations);
    if (newSelected.has(accId)) {
      newSelected.delete(accId);
    } else {
      newSelected.add(accId);
    }
    setSelectedAccommodations(newSelected);
  };

  const handleCreateItinerary = async () => {
    if (selectedAccommodations.size === 0) {
      toast.error("Please select at least one accommodation");
      return;
    }

    setLoading(true);
    try {
      // Get full accommodation data for selected accommodations
      const selectedAccommodationsData = accommodations.filter(acc => selectedAccommodations.has(acc.id));
      
      // Create itinerary with selected accommodations
      const { error } = await supabase
        .from("itineraries")
        .insert([{
          user_id: userId,
          name: "My Accommodation Itinerary",
          spots: selectedAccommodationsData as any,
          selected_categories: [...new Set(selectedAccommodationsData.flatMap(a => a.category))],
        }]);

      if (error) throw error;

      toast.success(`Created itinerary with ${selectedAccommodations.size} accommodations!`);
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

  const getPriceIcon = (priceRange: string) => {
    const count = (priceRange.match(/₱/g) || []).length;
    return "₱".repeat(Math.max(count, 1));
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Hotel className="w-6 h-6 text-primary" />
            Your Recommended Accommodations
          </DialogTitle>
          <DialogDescription>
            Based on your preferences, we've found these great places to stay. 
            Select the ones you'd like to add to your itinerary, or let us auto-select the top recommendations.
          </DialogDescription>
        </DialogHeader>

        {fetchingAccommodations ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <Button onClick={handleAutoSelect} variant="outline" className="gap-2">
                <Hotel className="w-4 h-4" />
                Auto-select Top 4
              </Button>
              <div className="flex-1" />
              <Badge variant="secondary" className="text-sm">
                {selectedAccommodations.size} selected
              </Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-4 py-4">
              {accommodations.map((accommodation) => (
                <Card
                  key={accommodation.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedAccommodations.has(accommodation.id) ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => toggleAccommodation(accommodation.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="flex items-start">
                        <Checkbox
                          checked={selectedAccommodations.has(accommodation.id)}
                          onCheckedChange={() => toggleAccommodation(accommodation.id)}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        {accommodation.image_url && (
                          <img
                            src={accommodation.image_url}
                            alt={accommodation.name}
                            className="w-full h-32 object-cover rounded-md mb-3"
                          />
                        )}
                        <h3 className="font-semibold text-lg mb-1 truncate">{accommodation.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{accommodation.location}</span>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                          {accommodation.rating > 0 && (
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm">{accommodation.rating.toFixed(1)}</span>
                            </div>
                          )}
                          {accommodation.price_range && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-600">
                                {getPriceIcon(accommodation.price_range)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {accommodation.category?.slice(0, 2).map((cat) => (
                            <Badge key={cat} variant="secondary" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                        {accommodation.amenities && accommodation.amenities.length > 0 && (
                          <div className="text-xs text-muted-foreground mb-2">
                            {accommodation.amenities.slice(0, 3).join(" • ")}
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {accommodation.description}
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
              <Button onClick={handleCreateItinerary} disabled={loading || selectedAccommodations.size === 0}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Itinerary with {selectedAccommodations.size > 0 ? `${selectedAccommodations.size} accommodations` : ""}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
