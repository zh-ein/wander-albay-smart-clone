import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BulkImport = () => {
  const [importing, setImporting] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const { toast } = useToast();

  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(';').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      const obj: any = {};
      
      headers.forEach((header, index) => {
        let value = values[index]?.trim() || null;
        
        // Parse JSON arrays
        if (value && value.startsWith('[') && value.endsWith(']')) {
          try {
            value = JSON.parse(value.replace(/"/g, '"'));
          } catch (e) {
            console.error('Failed to parse array:', value);
          }
        }
        
        // Handle empty strings
        if (value === '' || value === '""') {
          value = null;
        }
        
        obj[header] = value;
      });
      
      data.push(obj);
    }
    
    return data;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedType) {
      toast({
        title: "Error",
        description: "Please select a data type and file",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      const text = await file.text();
      const data = parseCSV(text);

      if (data.length === 0) {
        toast({
          title: "Error",
          description: "No data found in CSV file",
          variant: "destructive",
        });
        return;
      }

      let tableName = '';
      let cleanedData = data;

      // Map and clean data based on type
      switch (selectedType) {
        case 'accommodations':
          tableName = 'accommodations';
          cleanedData = data.map((item: any) => ({
            name: item.name,
            description: item.description,
            location: item.location,
            municipality: item.municipality,
            category: item.category,
            image_url: item.image_url,
            contact_number: item.contact_number,
            email: item.email,
            price_range: item.price_range,
            amenities: item.amenities,
            rating: item.rating ? parseFloat(item.rating) : 0,
            latitude: item.latitude ? parseFloat(item.latitude) : null,
            longitude: item.longitude ? parseFloat(item.longitude) : null,
          }));
          break;

        case 'tourist_spots':
          tableName = 'tourist_spots';
          cleanedData = data.map((item: any) => ({
            name: item.name,
            description: item.description,
            contact_number: item.contact_number,
            location: item.location,
            municipality: item.municipality,
            category: item.category,
            image_url: item.image_url,
            latitude: item.latitude ? parseFloat(item.latitude) : null,
            longitude: item.longitude ? parseFloat(item.longitude) : null,
            rating: item.rating ? parseFloat(item.rating) : 0,
            is_hidden_gem: item.is_hidden_gem === 'true' || item.is_hidden_gem === true,
          }));
          break;

        case 'restaurants':
          tableName = 'restaurants';
          cleanedData = data.map((item: any) => ({
            name: item.name,
            food_type: item.food_type,
            location: item.location,
            municipality: item.municipality,
            description: item.description,
            image_url: item.image_url,
          }));
          break;

        case 'events':
          tableName = 'events';
          cleanedData = data.map((item: any) => ({
            name: item.name,
            event_type: item.event_type,
            location: item.location,
            municipality: item.municipality,
            description: item.description,
            event_date: item.event_date,
            image_url: item.image_url,
            district: item.district,
          }));
          break;

        default:
          toast({
            title: "Error",
            description: "Invalid data type selected",
            variant: "destructive",
          });
          return;
      }

      // Insert data in batches
      const batchSize = 50;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < cleanedData.length; i += batchSize) {
        const batch = cleanedData.slice(i, i + batchSize);
        const { error } = await supabase.from(tableName as any).insert(batch as any);

        if (error) {
          console.error(`Batch ${i / batchSize + 1} error:`, error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }
      }

      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} records${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      });

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-6 h-6" />
            Bulk Import Data
          </CardTitle>
          <CardDescription>
            Import data from CSV files. Select the data type and upload your CSV file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Data Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Select data type to import" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accommodations">Accommodations</SelectItem>
                <SelectItem value="tourist_spots">Tourist Spots</SelectItem>
                <SelectItem value="restaurants">Restaurants</SelectItem>
                <SelectItem value="events">Events</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Upload CSV File</label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={importing || !selectedType}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
              />
            </div>
          </div>

          {importing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
              Importing data...
            </div>
          )}

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              CSV Format Requirements
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>First row must contain column headers</li>
              <li>Use semicolon (;) as separator</li>
              <li>Array fields should use JSON format: ["item1","item2"]</li>
              <li>Date fields should use YYYY-MM-DD format</li>
              <li>Ensure all required fields are present</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkImport;
