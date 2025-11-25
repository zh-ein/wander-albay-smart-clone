import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UtensilsCrossed, Loader2 } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface Restaurant {
  id: string;
  name: string;
  food_type: string | null;
  location: string;
  municipality: string | null;
  description: string | null;
  image_url: string | null;
}

interface Municipality {
  code: string;
  name: string;
}

interface Barangay {
  code: string;
  name: string;
}

const ManageRestaurants = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);

  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    food_type: [] as string[],
    location: "",
    municipality: "",
    description: "",
    image_url: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchRestaurants();
    fetchMunicipalities();
  }, []);

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .order("name");

    if (!error && data) {
      setRestaurants(data);
    }
  };

  const fetchMunicipalities = async () => {
    try {
      const [muniRes, cityRes] = await Promise.all([
        fetch("https://psgc.gitlab.io/api/provinces/050500000/municipalities/"),
        fetch("https://psgc.gitlab.io/api/provinces/050500000/cities/"),
      ]);

      const [muniData, cityData] = await Promise.all([muniRes.json(), cityRes.json()]);

      const merged = [...(muniData || []), ...(cityData || [])];

      if (Array.isArray(merged)) {
        const sorted = merged
          .map((m: any) => ({ code: m.code, name: m.name }))
          .sort((a: Municipality, b: Municipality) => a.name.localeCompare(b.name));
        setMunicipalities(sorted);
      } else {
        toast.error("Unexpected data format for municipalities/cities");
      }
    } catch (error) {
      console.error("Error fetching municipalities and cities:", error);
      toast.error("Failed to load municipalities and cities");
    }
  };

  const fetchBarangays = async (code: string) => {
    try {
      let response = await fetch(
        `https://psgc.gitlab.io/api/municipalities/${code}/barangays/`
      );
      if (!response.ok) {
        response = await fetch(`https://psgc.gitlab.io/api/cities/${code}/barangays/`);
      }
      const data = await response.json();

      if (Array.isArray(data)) {
        const sorted = data
          .map((b: any) => ({ code: b.code, name: b.name }))
          .sort((a: Barangay, b: Barangay) => a.name.localeCompare(b.name));
        setBarangays(sorted);
      } else {
        toast.error("Unexpected data format for barangays");
      }
    } catch (error) {
      console.error("Error fetching barangays:", error);
      toast.error("Failed to load barangays");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return formData.image_url || null;

    setUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `restaurants/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('spot-images')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('spot-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image: ' + error.message);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleMunicipalityChange = (code: string) => {
    const selectedMunicipality = municipalities.find((m) => m.code === code);
    setFormData((prev) => ({
      ...prev,
      municipality: selectedMunicipality?.name || "",
      location: "",
    }));
    setBarangays([]);
    if (code) fetchBarangays(code);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Upload image if a new file is selected
    const imageUrl = await uploadImage();

    if (imageFile && !imageUrl) {
      toast.error('Failed to upload image. Please try again.');
      setIsLoading(false);
      return;
    }

    const restaurantData = {
      name: formData.name,
      food_type: formData.food_type.length ? formData.food_type.join(", ") : null,
      location: formData.location,
      municipality: formData.municipality || null,
      description: formData.description || null,
      image_url: imageUrl,
    };

    if (editingRestaurant) {
      const { error } = await supabase
        .from("restaurants")
        .update(restaurantData)
        .eq("id", editingRestaurant.id);

      if (error) {
        toast.error("Failed to update restaurant");
      } else {
        toast.success("Restaurant updated successfully");
        resetForm();
        fetchRestaurants();
      }
    } else {
      const { error } = await supabase.from("restaurants").insert([restaurantData]);

      if (error) {
        toast.error("Failed to add restaurant");
      } else {
        toast.success("Restaurant added successfully");
        resetForm();
        fetchRestaurants();
      }
    }

    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this restaurant?")) return;

    const { error } = await supabase.from("restaurants").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete restaurant");
    } else {
      toast.success("Restaurant deleted successfully");
      fetchRestaurants();
    }
  };

  const handleEdit = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setFormData({
      name: restaurant.name,
      food_type: restaurant.food_type ? restaurant.food_type.split(", ").map(t => t.trim()) : [],
      location: restaurant.location,
      municipality: restaurant.municipality || "",
      description: restaurant.description || "",
      image_url: restaurant.image_url || "",
    });
    setImagePreview(restaurant.image_url);
    setImageFile(null);

    const muni = municipalities.find((m) => m.name === restaurant.municipality);
    if (muni?.code) {
      fetchBarangays(muni.code);
    } else {
      fetchMunicipalities().then(() => {
        const found = municipalities.find((m) => m.name === restaurant.municipality);
        if (found?.code) fetchBarangays(found.code);
      });
    }

    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      food_type: [],
      location: "",
      municipality: "",
      description: "",
      image_url: "",
    });
    setEditingRestaurant(null);
    setBarangays([]);
    setImageFile(null);
    setImagePreview(null);
    setIsDialogOpen(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Restaurants ({restaurants.length})</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Restaurant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRestaurant ? "Edit" : "Add"} Restaurant</DialogTitle>
              <DialogDescription>Fill in the restaurant details</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Name */}
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* Multi-select Food Type */}
              <div>
                <Label htmlFor="food_type">Food Type</Label>
                <Select
                  onValueChange={(value) => {
                    setFormData((prev) => {
                      const alreadySelected = prev.food_type.includes(value);
                      const updated = alreadySelected
                        ? prev.food_type.filter((t) => t !== value)
                        : [...prev.food_type, value];
                      return { ...prev, food_type: updated };
                    });
                  }}
                  value=""
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        formData.food_type.length > 0
                          ? formData.food_type.join(", ")
                          : "Select food types"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Filipino",
                      "Korean",
                      "Japanese",
                      "Sea Food",
                      "Fast Food",
                      "Desserts",
                      "Cafe",
                      "Casual",
                      "Buffet",
                    ].map((type) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.food_type.includes(type)}
                            readOnly
                          />
                          <span>{type}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Municipality/City Dropdown */}
              <div>
                <Label>Municipality or City</Label>
                <Select
                  onValueChange={handleMunicipalityChange}
                  value={municipalities.find((m) => m.name === formData.municipality)?.code || ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select municipality or city" />
                  </SelectTrigger>
                  <SelectContent>
                    {municipalities.map((m) => (
                      <SelectItem key={m.code} value={m.code}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Barangay (Location) Dropdown */}
              <div>
                <Label>Location (Barangay) *</Label>
                <Select
                  onValueChange={(code) => {
                    const barangay = barangays.find((b) => b.code === code);
                    setFormData((prev) => ({ ...prev, location: barangay?.name || "" }));
                  }}
                  value={barangays.find((b) => b.name === formData.location)?.code || ""}
                  disabled={!barangays.length}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={barangays.length ? "Select a barangay" : "Select municipality first"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {barangays.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Image Upload */}
              <div>
                <Label htmlFor="image-upload">Restaurant Image</Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Upload an image (max 5MB, JPG/PNG/WEBP)
                </p>
                
                {imagePreview && (
                  <div className="mt-3 relative">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setFormData({ ...formData, image_url: "" });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={isLoading || uploadingImage}>
                  {isLoading || uploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {uploadingImage ? "Uploading..." : "Saving..."}
                    </>
                  ) : (
                    <>{editingRestaurant ? "Update" : "Add"} Restaurant</>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isLoading || uploadingImage}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Restaurant List */}
      <div className="grid gap-4">
        {restaurants.map((restaurant) => (
          <Card key={restaurant.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <UtensilsCrossed className="w-5 h-5 text-accent" />
                    <CardTitle>{restaurant.name}</CardTitle>
                  </div>
                  {restaurant.food_type && (
                    <p className="text-sm font-medium text-primary mb-1">{restaurant.food_type}</p>
                  )}
                  <p className="text-sm text-muted-foreground mb-2">{restaurant.location}</p>
                  {restaurant.description && (
                    <p className="text-sm text-muted-foreground">{restaurant.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(restaurant)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(restaurant.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ManageRestaurants;
