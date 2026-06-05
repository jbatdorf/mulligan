export interface PlaceCandidate {
  googlePlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface PlacesService {
  search(query: string): Promise<PlaceCandidate[]>;
}

// Stub implementation — returns a fixed set of candidates for any query.
// Replace with a real Google Places Text Search call when ready.
export const stubPlacesService: PlacesService = {
  async search(_query) {
    return [
      {
        googlePlaceId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
        name: "Pebble Beach Golf Links",
        address: "1700 17-Mile Dr, Pebble Beach, CA 93953",
        lat: 36.5681,
        lng: -121.9483,
      },
      {
        googlePlaceId: "ChIJa7TpBq0L9YgRFMhLvMNrFiA",
        name: "Augusta National Golf Club",
        address: "2604 Washington Rd, Augusta, GA 30904",
        lat: 33.5021,
        lng: -82.0221,
      },
    ];
  },
};
