// Import React hooks for state management and effects
import { useState, useEffect } from "react";
// Import navigation hook
import { useNavigate } from "react-router-dom";
// Import UI components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
// Import icons
import { 
  Search as SearchIcon, 
  MapPin, 
  Star, 
  Heart, 
  Loader2, 
  AlertCircle,
  Filter,
  X,
  Award,
  Briefcase,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
// Import API client
import { userAPI } from "@/lib/api";
// Import toast notifications
import { useToast } from "@/hooks/use-toast";
// Import image URL helper
import { getFullImageUrl } from "@/utils/imageUrl";
// Import ProximityBasedSearch component
import ProximityBasedSearch from "@/components/ProximityBasedSearch";

interface Caregiver {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  location?: string;
  dailyRate?: number;
  weeklyRate?: number;
  specialization?: string;
  serviceType?: string;
  yearsExperience?: number;
  rating?: number;
  reviewCount?: number;
  totalReviews?: number;
  profilePicture?: string;
  bio?: string;
  status?: string;
  isApproved?: boolean;
  certifications?: string[];
  providedServices?: string[];
  availability?: {
    monday?: boolean;
    tuesday?: boolean;
    wednesday?: boolean;
    thursday?: boolean;
    friday?: boolean;
    saturday?: boolean;
    sunday?: boolean;
  };
}

interface FindCaregiverProps {
  isEmbedded?: boolean;
}

// FindCaregiver component - Display list of all registered caregivers with search and filter functionality
// Can be used standalone or embedded within dashboard
const FindCaregiver = ({ isEmbedded = false }: FindCaregiverProps = {}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State management
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [filteredCaregivers, setFilteredCaregivers] = useState<Caregiver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRating, setFilterRating] = useState<string>("all");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [searchMode, setSearchMode] = useState<"general" | "proximity">("general");

  // Fetch caregivers on component mount
  useEffect(() => {
    fetchCaregivers();
  }, []);

  // Fetch caregivers from API
  const fetchCaregivers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await userAPI.getCaregivers();
      
      // Display all caregivers registered to the system
      setCaregivers(response);
      setFilteredCaregivers(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch caregivers';
      setError(errorMessage);
      console.error('Error fetching caregivers:', err);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and search caregivers
  useEffect(() => {
    let filtered = caregivers;

    // Apply search term filter
    if (searchTerm) {
      filtered = filtered.filter((caregiver) => {
        const fullName = `${caregiver.firstName} ${caregiver.lastName}`.toLowerCase();
        const location = (caregiver.location || "").toLowerCase();
        const specialization = (caregiver.specialization || "").toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        
        return (
          fullName.includes(searchLower) ||
          location.includes(searchLower) ||
          specialization.includes(searchLower)
        );
      });
    }

    // Apply rating filter
    if (filterRating !== "all") {
      const minRating = parseFloat(filterRating);
      filtered = filtered.filter(
        (caregiver) => (caregiver.rating || 0) >= minRating
      );
    }

    setFilteredCaregivers(filtered);
  }, [searchTerm, filterRating, caregivers]);

  // Toggle favorite caregiver
  const toggleFavorite = (caregiverId: string) => {
    setFavoriteIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(caregiverId)) {
        newSet.delete(caregiverId);
      } else {
        newSet.add(caregiverId);
      }
      return newSet;
    });
  };

  // Toggle expanded card details
  const toggleCardExpanded = (caregiverId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(caregiverId)) {
        newSet.delete(caregiverId);
      } else {
        newSet.add(caregiverId);
      }
      return newSet;
    });
  };

  // Navigate to caregiver profile
  const goToProfile = (caregiverId: string) => {
    navigate(`/caregiver/${caregiverId}`);
  };

  const bookNow = (caregiverId: string) => {
    navigate(`/booking?caregiver=${caregiverId}`);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setFilterRating("all");
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={isEmbedded ? "w-full" : "min-h-screen bg-gradient-to-b from-slate-50 to-slate-100"}>
        <div className={isEmbedded ? "w-full" : "max-w-7xl mx-auto px-4 py-8"}>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Find a Caregiver</h1>
            <p className="text-slate-600">Browse our network of qualified caregivers</p>
          </div>

          {/* Loading skeleton grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="pt-4">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={isEmbedded ? "w-full" : "min-h-screen bg-gradient-to-b from-slate-50 to-slate-100"}>
        <div className={isEmbedded ? "w-full" : "max-w-7xl mx-auto px-4 py-8"}>
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <CardTitle className="text-red-900">Error Loading Caregivers</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-red-800">
              {error}
              <Button
                onClick={fetchCaregivers}
                className="mt-4 bg-red-600 hover:bg-red-700"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "w-full" : "min-h-screen bg-gradient-to-b from-slate-50 to-slate-100"}>
      <div className={isEmbedded ? "w-full" : "max-w-7xl mx-auto px-4 py-8"}>
        {/* Header - Only show on standalone */}
        {!isEmbedded && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Find a Caregiver</h1>
            <p className="text-slate-600">Browse our network of {caregivers.length} qualified caregivers</p>
          </div>
        )}

        {/* Search Mode Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setSearchMode("general")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                searchMode === "general"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Browse All Caregivers
            </button>
            <button
              onClick={() => setSearchMode("proximity")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                searchMode === "proximity"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Find by Location
            </button>
          </div>
        </div>

        {/* Content based on search mode */}
        {searchMode === "proximity" ? (
          <ProximityBasedSearch />
        ) : (
          <>
            {/* Search and Filter Section */}
        <Card className="mb-8 bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search and Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by name, location, or specialization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>

            {/* Filters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Minimum Rating
                </label>
                <select
                  value={filterRating}
                  onChange={(e) => setFilterRating(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Ratings</option>
                  <option value="4.5">4.5+ Stars</option>
                  <option value="4">4+ Stars</option>
                  <option value="3.5">3.5+ Stars</option>
                  <option value="3">3+ Stars</option>
                </select>
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="w-full text-slate-600 border-slate-300 hover:bg-slate-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Active Filters Summary */}
            {(searchTerm || filterRating !== "all") && (
              <div className="pt-2 border-t border-slate-200">
                <div className="flex flex-wrap gap-2">
                  {searchTerm && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      Search: "{searchTerm}"
                    </Badge>
                  )}
                  {filterRating !== "all" && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      Rating: {filterRating}+ Stars
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-slate-600">
            Showing <span className="font-semibold text-slate-900">{filteredCaregivers.length}</span> of{" "}
            <span className="font-semibold text-slate-900">{caregivers.length}</span> caregivers
          </p>
        </div>

        {/* No Results */}
        {filteredCaregivers.length === 0 ? (
          <Card className="text-center py-12 border-slate-200">
            <CardContent>
              <SearchIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No caregivers found</h3>
              <p className="text-slate-600 mb-4">
                Try adjusting your search filters
              </p>
              <Button onClick={clearFilters} variant="outline">
                Clear All Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Caregivers Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCaregivers.map((caregiver) => {
              const isExpanded = expandedCards.has(caregiver._id);
              const fullName = caregiver.name || `${caregiver.firstName} ${caregiver.lastName}`;
              const availableDays = caregiver.availability ? Object.entries(caregiver.availability)
                .filter(([_, available]) => available)
                .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1))
                .slice(0, 5) : [];

              return (
                <Card
                  key={caregiver._id}
                  className="overflow-hidden hover:shadow-lg transition-all duration-200 border-slate-200 flex flex-col"
                >
                  {/* Profile Header with name overlay */}
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-24 relative">
                    {/* Profile Picture */}
                    {caregiver.profilePicture && (
                      <img
                        src={getFullImageUrl(caregiver.profilePicture) || caregiver.profilePicture}
                        alt={fullName}
                        className="w-20 h-20 rounded-full border-4 border-white absolute bottom-0 left-4 object-cover z-0"
                      />
                    )}
                  </div>

                  <CardContent className="pt-12 pb-4 flex-1 flex flex-col">
                    {/* Name */}
                    <h3 className="text-lg font-bold text-slate-900">
                      {fullName}
                    </h3>

                    {/* Rating */}
                    <div className="flex items-center gap-1 mt-1 mb-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(caregiver.rating || 0)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-slate-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-slate-600">
                        ({caregiver.reviewCount || caregiver.totalReviews || 0})
                      </span>
                    </div>

                    {/* Service Type Badge */}
                    {(caregiver.specialization || caregiver.serviceType) && (
                      <Badge className="bg-blue-100 text-blue-800 mb-3 w-fit">
                        {caregiver.specialization || caregiver.serviceType}
                      </Badge>
                    )}

                    {/* Location */}
                    {caregiver.location && (
                      <div className="flex items-center gap-1 text-sm text-slate-600 mb-2">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span>{caregiver.location}</span>
                      </div>
                    )}

                    {/* Experience */}
                    {caregiver.yearsExperience && (
                      <p className="text-sm text-slate-600 mb-3">
                        <span className="font-semibold">{caregiver.yearsExperience}</span> years experience
                      </p>
                    )}

                    {/* Rates */}
                    <div className="bg-slate-50 rounded-lg p-3 mb-4">
                      <p className="text-xs text-slate-600 font-semibold mb-1">Rates</p>
                      <div className="text-sm space-y-1">
                        {caregiver.dailyRate && (
                          <p className="text-slate-900">
                            <span className="font-semibold">GH₵{caregiver.dailyRate}</span>/day
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bio Preview */}
                    {caregiver.bio && (
                      <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                        {caregiver.bio}
                      </p>
                    )}

                    {/* Expandable Details Section */}
                    {(caregiver.certifications?.length || caregiver.providedServices?.length || availableDays.length) && (
                      <div className="border-t border-slate-200 pt-4 mt-auto">
                        <button
                          onClick={() => toggleCardExpanded(caregiver._id)}
                          className="flex items-center justify-between w-full text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          <span>View Details</span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-4 space-y-3 animate-in fade-in-50 duration-200">
                            {/* Certifications */}
                            {caregiver.certifications && caregiver.certifications.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                                  <Award className="h-4 w-4" />
                                  Certifications
                                </h4>
                                <div className="space-y-1">
                                  {caregiver.certifications.map((cert, idx) => (
                                    <div key={idx} className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1 text-green-700 flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                                      <span>{typeof cert === 'string' ? cert : cert.name || cert}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Services Provided */}
                            {caregiver.providedServices && caregiver.providedServices.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                                  <Briefcase className="h-4 w-4" />
                                  Services
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                  {caregiver.providedServices.map((service, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                                      {service}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Availability */}
                            {availableDays.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  Available
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                  {availableDays.map((day, idx) => (
                                    <span key={idx} className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                                      {day}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                      <div className="space-y-2">
                      <Button
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToProfile(caregiver._id);
                        }}
                      >
                        View Full Profile
                      </Button>
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          bookNow(caregiver._id);
                        }}
                      >
                        Book Now
                      </Button>
                    </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default FindCaregiver;
