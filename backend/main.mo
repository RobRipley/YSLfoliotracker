import OrderedMap "mo:base/OrderedMap";
import Array "mo:base/Array";
import Text "mo:base/Text";
import Float "mo:base/Float";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Principal "mo:base/Principal";
import Debug "mo:base/Debug";
import Nat "mo:base/Nat";
// Nat8 available via Blob.toArray if needed
import Iter "mo:base/Iter";
import Blob "mo:base/Blob";
import Option "mo:base/Option";
import AccessControl "authorization/access-control";

persistent actor CryptoPortfolioTracker {

  // Initialize the access control system
  transient let accessControlState = AccessControl.initState();

  // ============================================================================
  // PORTFOLIO BLOB STORAGE (persists across upgrades)
  // Stores each user's entire portfolio state as a JSON string.
  // This is the primary storage - localStorage is just a local cache.
  // ============================================================================
  transient let portfolioBlobMap = OrderedMap.Make<Principal>(Principal.compare);
  var portfolioBlobs : OrderedMap.Map<Principal, Text> = portfolioBlobMap.empty<Text>();
  // Track last-modified timestamps per user
  var portfolioBlobTimestamps : OrderedMap.Map<Principal, Int> = portfolioBlobMap.empty<Int>();

  /// Save the user's entire portfolio state as a JSON blob.
  /// The frontend serializes holdings, settings, exit plans, etc. into one string.
  public shared ({ caller }) func save_portfolio_blob(jsonBlob : Text) : async { ok : Bool; timestamp : Int } {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Anonymous callers cannot save portfolio data");
    };
    // Auto-register user if needed (same as initializeAccessControl logic)
    autoRegister(caller);
    let now = Time.now();
    portfolioBlobs := portfolioBlobMap.put(portfolioBlobs, caller, jsonBlob);
    portfolioBlobTimestamps := portfolioBlobMap.put(portfolioBlobTimestamps, caller, now);
    { ok = true; timestamp = now };
  };

  /// Load the user's portfolio state. Returns null if no data saved yet.
  public query ({ caller }) func load_portfolio_blob() : async ?Text {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Anonymous callers cannot load portfolio data");
    };
    portfolioBlobMap.get(portfolioBlobs, caller);
  };

  /// Get the timestamp of the user's last save (for sync conflict detection).
  public query ({ caller }) func get_portfolio_timestamp() : async ?Int {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Anonymous callers cannot access portfolio timestamps");
    };
    portfolioBlobMap.get(portfolioBlobTimestamps, caller);
  };

  /// Delete the user's portfolio data (for account reset).
  public shared ({ caller }) func delete_portfolio_blob() : async { ok : Bool } {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Anonymous callers cannot delete portfolio data");
    };
    portfolioBlobs := portfolioBlobMap.delete(portfolioBlobs, caller);
    portfolioBlobTimestamps := portfolioBlobMap.delete(portfolioBlobTimestamps, caller);
    { ok = true };
  };

  /// Admin-only: get total number of users with saved portfolios (for monitoring).
  public query ({ caller }) func get_portfolio_user_count() : async Nat {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Debug.trap("Unauthorized: Only admins can view user counts");
    };
    portfolioBlobMap.size(portfolioBlobs);
  };

  // ============================================================================
  // SHARED LOGO REGISTRY FUNCTIONS
  // ============================================================================

  // --- Legacy URL-based functions (kept for backward compat) ---

  /// Get the entire shared logo URL registry as an array of (coingeckoId, logoUrl) pairs.
  /// Query call (free, fast) - any authenticated user can read.
  public query ({ caller }) func get_logo_registry() : async [(Text, Text)] {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Anonymous callers cannot access the logo registry");
    };
    Iter.toArray(textMap.entries(logoRegistry));
  };

  /// Add or update a single logo URL in the shared registry.
  public shared ({ caller }) func set_logo(coingeckoId : Text, logoUrl : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can update the logo registry");
    };
    logoRegistry := textMap.put(logoRegistry, coingeckoId, logoUrl);
  };

  /// Bulk add logo URLs to the shared registry.
  public shared ({ caller }) func set_logos_bulk(entries : [(Text, Text)]) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can update the logo registry");
    };
    var count : Nat = 0;
    for ((coingeckoId, logoUrl) in entries.vals()) {
      switch (textMap.get(logoRegistry, coingeckoId)) {
        case (?_existing) {};
        case null {
          logoRegistry := textMap.put(logoRegistry, coingeckoId, logoUrl);
          count += 1;
        };
      };
    };
    count;
  };

  // --- Image blob registry (actual image bytes) ---

  /// Store a single logo image (actual PNG/JPEG bytes) in the shared registry.
  /// Any authenticated user can upload. Will overwrite existing entry.
  public shared ({ caller }) func set_logo_image(coingeckoId : Text, contentType : Text, imageData : Blob) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can upload logo images");
    };
    // Validate content type
    if (contentType != "image/png" and contentType != "image/jpeg" and contentType != "image/svg+xml" and contentType != "image/webp") {
      Debug.trap("Invalid content type. Must be image/png, image/jpeg, image/svg+xml, or image/webp");
    };
    // Enforce max size: 100KB per image
    if (Blob.toArray(imageData).size() > 102_400) {
      Debug.trap("Image too large. Maximum 100KB per logo");
    };
    logoImageData := textMap.put(logoImageData, coingeckoId, imageData);
    logoContentTypes := textMap.put(logoContentTypes, coingeckoId, contentType);
  };

  /// Bulk store logo images. Only adds entries that don't already exist.
  /// Returns the number of NEW entries added.
  public shared ({ caller }) func set_logo_images_bulk(entries : [(Text, Text, Blob)]) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can upload logo images");
    };
    var count : Nat = 0;
    for ((coingeckoId, contentType, imageData) in entries.vals()) {
      switch (textMap.get(logoImageData, coingeckoId)) {
        case (?_existing) {}; // Skip — already have this logo
        case null {
          // Only store if valid size and type
          if (Blob.toArray(imageData).size() <= 102_400) {
            logoImageData := textMap.put(logoImageData, coingeckoId, imageData);
            logoContentTypes := textMap.put(logoContentTypes, coingeckoId, contentType);
            count += 1;
          };
        };
      };
    };
    count;
  };

  /// Get a single logo image by coingeckoId.
  /// Returns null if not found. Query call (free, fast).
  public query ({ caller }) func get_logo_image(coingeckoId : Text) : async ?(Text, Blob) {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Anonymous callers cannot access logo images");
    };
    switch (textMap.get(logoImageData, coingeckoId)) {
      case (?data) {
        let ct = Option.get(textMap.get(logoContentTypes, coingeckoId), "image/png");
        ?(ct, data);
      };
      case null { null };
    };
  };

  /// Check if a logo image exists for a given coingeckoId.
  /// Query call (free, fast). Returns true/false.
  public query ({ caller }) func has_logo_image(coingeckoId : Text) : async Bool {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Anonymous callers cannot access logo images");
    };
    Option.isSome(textMap.get(logoImageData, coingeckoId));
  };

  /// Get the list of all coingeckoIds that have stored logo images.
  /// Query call (free, fast). Returns array of ids.
  public query ({ caller }) func get_logo_image_ids() : async [Text] {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Anonymous callers cannot access logo images");
    };
    let entries = Iter.toArray(textMap.entries(logoImageData));
    Array.map<(Text, Blob), Text>(entries, func((id, _)) { id });
  };

  /// Get the number of entries in the logo registries (for monitoring).
  public query ({ caller }) func get_logo_registry_size() : async Nat {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Anonymous callers cannot access the logo registry");
    };
    textMap.size(logoRegistry);
  };

  /// Get the number of logo IMAGES stored (actual bytes, not URLs).
  public query ({ caller }) func get_logo_image_count() : async Nat {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Anonymous callers cannot access the logo registry");
    };
    textMap.size(logoImageData);
  };

  // ============================================================================
  // HTTP REQUEST HANDLER — serves logo images directly via canister URL
  // GET /logo/{coingeckoId} → returns the image bytes with correct Content-Type
  // GET /logo-ids → returns JSON array of all stored coingeckoIds
  // ============================================================================

  public type HttpRequest = {
    url : Text;
    method : Text;
    body : Blob;
    headers : [(Text, Text)];
  };

  public type HttpResponse = {
    status_code : Nat16;
    headers : [(Text, Text)];
    body : Blob;
  };

  public query func http_request(req : HttpRequest) : async HttpResponse {
    let path = req.url;

    // GET /logo/{coingeckoId} — serve logo image bytes
    if (Text.startsWith(path, #text "/logo/")) {
      let coingeckoId = stripPrefix(path, "/logo/");
      switch (textMap.get(logoImageData, coingeckoId)) {
        case (?data) {
          let contentType = Option.get(textMap.get(logoContentTypes, coingeckoId), "image/png");
          return {
            status_code = 200;
            headers = [
              ("Content-Type", contentType),
              ("Cache-Control", "public, max-age=86400"), // 24h cache
              ("Access-Control-Allow-Origin", "*"),
            ];
            body = data;
          };
        };
        case null {
          return {
            status_code = 404;
            headers = [("Content-Type", "text/plain"), ("Access-Control-Allow-Origin", "*")];
            body = Text.encodeUtf8("Logo not found: " # coingeckoId);
          };
        };
      };
    };

    // GET /logo-ids — return JSON list of all stored logo IDs
    if (path == "/logo-ids") {
      let entries = Iter.toArray(textMap.entries(logoImageData));
      var json = "[";
      var first = true;
      for ((id, _) in entries.vals()) {
        if (not first) { json #= "," };
        json #= "\"" # id # "\"";
        first := false;
      };
      json #= "]";
      return {
        status_code = 200;
        headers = [
          ("Content-Type", "application/json"),
          ("Cache-Control", "public, max-age=300"), // 5 min cache
          ("Access-Control-Allow-Origin", "*"),
        ];
        body = Text.encodeUtf8(json);
      };
    };

    // GET /logo-count — return count of stored logos
    if (path == "/logo-count") {
      let count = textMap.size(logoImageData);
      return {
        status_code = 200;
        headers = [
          ("Content-Type", "application/json"),
          ("Access-Control-Allow-Origin", "*"),
        ];
        body = Text.encodeUtf8("{\"count\":" # Nat.toText(count) # "}");
      };
    };

    // Default: 404
    {
      status_code = 404;
      headers = [("Content-Type", "text/plain")];
      body = Text.encodeUtf8("Not found");
    };
  };

  /// Strip a prefix from a text string. Returns the remainder after the prefix.
  private func stripPrefix(text : Text, prefix : Text) : Text {
    let prefixSize = Text.size(prefix);
    let textSize = Text.size(text);
    if (textSize <= prefixSize) return "";
    // Use Iter to skip prefix characters
    var result = "";
    var i = 0;
    for (c in Text.toIter(text)) {
      if (i >= prefixSize) {
        result #= Text.fromChar(c);
      };
      i += 1;
    };
    result;
  };

  // Auto-register caller as user if not already registered
  private func autoRegister(caller : Principal) {
    if (not Principal.isAnonymous(caller)) {
      AccessControl.initialize(accessControlState, caller);
    };
  };

  // Initialize auth (first caller becomes admin, others become users)
  public shared ({ caller }) func initializeAccessControl() : async () {
    AccessControl.initialize(accessControlState, caller);
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    // Admin-only check happens inside assignRole
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    AccessControl.isAdmin(accessControlState, caller);
  };

  // User Profile System
  public type UserProfile = {
    firstName : Text;
    lastName : Text;
    updatedAt : Int;
  };

  transient let principalMap = OrderedMap.Make<Principal>(Principal.compare);
  transient var userProfiles = principalMap.empty<UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can access profiles");
    };
    principalMap.get(userProfiles, caller);
  };

  // Simplified profile getter - alias for getCallerUserProfile
  public query ({ caller }) func get_profile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can access profiles");
    };
    principalMap.get(userProfiles, caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    // Allow users to view their own profile, or admins to view any profile
    let isOwner = caller == user;
    let isAdmin = AccessControl.isAdmin(accessControlState, caller);

    if (not isOwner and not isAdmin) {
      Debug.trap("Unauthorized: Can only view your own profile or must be admin");
    };

    principalMap.get(userProfiles, user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles := principalMap.put(userProfiles, caller, profile);
  };

  // Upsert profile with firstName and lastName - creates or updates
  public shared ({ caller }) func upsert_profile(firstName : Text, lastName : Text) : async UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can save profiles");
    };
    let profile : UserProfile = {
      firstName = firstName;
      lastName = lastName;
      updatedAt = Time.now();
    };
    userProfiles := principalMap.put(userProfiles, caller, profile);
    profile;
  };

  // Data structures using Principal as key instead of Text
  transient var userPortfolios = principalMap.empty<[Holding]>();
  transient var adminSettings = principalMap.empty<AdminSettings>();
  transient var performanceHistory = principalMap.empty<[PortfolioPerformance]>();
  transient var uiPreferences = principalMap.empty<UIPreferences>();
  transient var exitStrategies = principalMap.empty<[ExitStrategy]>();

  // Market data cache is shared across all users (public read access)
  transient let textMap = OrderedMap.Make<Text>(Text.compare);
  transient var marketDataCache : OrderedMap.Map<Text, [MarketAsset]> = textMap.empty<[MarketAsset]>();

  // ============================================================================
  // SHARED LOGO REGISTRY (persists across upgrades, shared across ALL users)
  // Stores actual image bytes (PNG/JPEG) keyed by coingeckoId.
  // Any authenticated user can read; any user can upload new logos.
  // When any user resolves a logo, it becomes available to all users instantly.
  //
  // Two maps:
  //   logoImageData: coingeckoId → raw image bytes (Blob)
  //   logoContentTypes: coingeckoId → MIME type ("image/png", "image/jpeg")
  //
  // Served via http_request at /logo/{coingeckoId}
  // ============================================================================
  var logoImageData : OrderedMap.Map<Text, Blob> = textMap.empty<Blob>();
  var logoContentTypes : OrderedMap.Map<Text, Text> = textMap.empty<Text>();

  // Legacy URL registry — kept for backward compat during migration
  // Once all logos are stored as blobs, this can be removed.
  var logoRegistry : OrderedMap.Map<Text, Text> = textMap.empty<Text>();

  type Holding = {
    ticker : Text;
    quantity : Float;
    purchasePrice : Float;
    purchaseDate : Int;
  };

  type AdminSettings = {
    themeSettings : ThemeSettings;
    numberFormatting : NumberFormatting;
    categoryThresholds : CategoryThresholds;
    ladderPresets : LadderPresets;
    priceProviderSettings : PriceProviderSettings;
  };

  type ThemeSettings = {
    selectedTheme : Text;
    hueAdjustment : Float;
    darkMode : Bool;
    fontSize : Text;
  };

  type NumberFormatting = {
    pricePrecision : Nat;
    tokenPrecision : Nat;
    defaultCurrency : Text;
  };

  type CategoryThresholds = {
    blueMin : Float;
    midMin : Float;
    lowMin : Float;
  };

  type LadderPresets = {
    blueChipConservative : [LadderRung];
    midCapAggressive : [LadderRung];
    midCapConservative : [LadderRung];
    lowCapAggressive : [LadderRung];
    lowCapConservative : [LadderRung];
    customPresets : [CustomPreset];
  };

  type LadderRung = {
    multiplier : Float;
    sellPercent : Float;
  };

  type CustomPreset = {
    name : Text;
    rungs : [LadderRung];
    tokensHeldAside : Float;
    categories : [Text];
  };

  type PriceProviderSettings = {
    fallbackEnabled : Bool;
    cacheTTL : Int;
  };

  type PortfolioPerformance = {
    timestamp : Int;
    totalValue : Float;
    blueChipValue : Float;
    midCapValue : Float;
    lowCapValue : Float;
  };

  type MarketAsset = {
    symbol : Text;
    name : Text;
    price : Float;
    change24h : Float;
    marketCap : Float;
    volume24h : Float;
  };

  type UIPreferences = {
    overviewMode : Bool;
    tableDensity : Text;
    hiddenColumns : [Text];
    sidebarWidth : Float;
  };

  type ExitStrategy = {
    asset : Text;
    targetPrice : Float;
    sellPercentage : Float;
    basePrice : Float;
    isBase : Bool;
  };

  // Portfolio Management Functions - User can only access their own data
  public shared ({ caller }) func addHolding(ticker : Text, quantity : Float, purchasePrice : Float) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can add holdings");
    };

    let holding : Holding = {
      ticker;
      quantity;
      purchasePrice;
      purchaseDate = Time.now();
    };

    let currentHoldings = switch (principalMap.get(userPortfolios, caller)) {
      case (?holdings) holdings;
      case null [];
    };

    let updatedHoldings = Array.append(currentHoldings, [holding]);
    userPortfolios := principalMap.put(userPortfolios, caller, updatedHoldings);
  };

  public query ({ caller }) func getPortfolio() : async ?[Holding] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view portfolios");
    };
    principalMap.get(userPortfolios, caller);
  };

  // Admin Settings - User can only access their own settings
  public shared ({ caller }) func updateAdminSettings(settings : AdminSettings) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can update settings");
    };
    adminSettings := principalMap.put(adminSettings, caller, settings);
  };

  public query ({ caller }) func getAdminSettings() : async ?AdminSettings {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view settings");
    };
    principalMap.get(adminSettings, caller);
  };

  // Market Data Functions - These are now handled by frontend
  // HTTP outcalls removed - frontend uses CryptoRates.ai/CoinGecko directly
  // public shared ({ caller }) func fetchCoinGeckoData(endpoint : Text) : async Text - REMOVED
  // public shared ({ caller }) func getMarketData(endpoint : Text) : async Text - REMOVED

  // Market data cache - shared across users but requires authentication to write
  public shared ({ caller }) func cacheMarketData(cacheKey : Text, assets : [MarketAsset]) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can cache market data");
    };
    marketDataCache := textMap.put(marketDataCache, cacheKey, assets);
  };

  // Read access to cached market data requires authentication
  public query ({ caller }) func getCachedMarketData(cacheKey : Text) : async ?[MarketAsset] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can access cached market data");
    };
    textMap.get(marketDataCache, cacheKey);
  };

  public query ({ caller }) func filterMarketData(cacheKey : Text, minMarketCap : Float, maxMarketCap : Float, minVolume : Float, searchTerm : Text) : async ?[MarketAsset] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can filter market data");
    };
    switch (textMap.get(marketDataCache, cacheKey)) {
      case (?assets) {
        let filtered = Array.filter<MarketAsset>(
          assets,
          func(asset) {
            asset.marketCap >= minMarketCap and asset.marketCap <= maxMarketCap and asset.volume24h >= minVolume and (Text.contains(Text.toLowercase(asset.symbol), #text(Text.toLowercase(searchTerm))) or Text.contains(Text.toLowercase(asset.name), #text(Text.toLowercase(searchTerm))))
          },
        );
        ?filtered;
      };
      case null null;
    };
  };

  public query ({ caller }) func sortMarketData(cacheKey : Text, sortBy : Text, ascending : Bool) : async ?[MarketAsset] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can sort market data");
    };
    switch (textMap.get(marketDataCache, cacheKey)) {
      case (?assets) {
        let sorted = Array.sort<MarketAsset>(
          assets,
          func(a, b) {
            let comparison = switch (sortBy) {
              case ("price") Float.compare(a.price, b.price);
              case ("change24h") Float.compare(a.change24h, b.change24h);
              case ("marketCap") Float.compare(a.marketCap, b.marketCap);
              case ("volume24h") Float.compare(a.volume24h, b.volume24h);
              case _ Text.compare(a.symbol, b.symbol);
            };
            if (ascending) comparison else switch (comparison) {
              case (#less) #greater;
              case (#greater) #less;
              case (#equal) #equal;
            };
          },
        );
        ?sorted;
      };
      case null null;
    };
  };

  // Export Functions - User can only export their own data
  public query ({ caller }) func exportPortfolio() : async ?Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can export portfolios");
    };
    switch (principalMap.get(userPortfolios, caller)) {
      case (?holdings) {
        var csv = "Ticker,Quantity,Purchase Price,Purchase Date\n";
        for (holding in holdings.vals()) {
          csv := csv # holding.ticker # "," # Float.toText(holding.quantity) # "," # Float.toText(holding.purchasePrice) # "," # Int.toText(holding.purchaseDate) # "\n";
        };
        ?csv;
      };
      case null null;
    };
  };

  // Performance History - User can only access their own data
  public shared ({ caller }) func recordPerformanceSnapshot(totalValue : Float, blueChipValue : Float, midCapValue : Float, lowCapValue : Float) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can record performance snapshots");
    };

    let snapshot : PortfolioPerformance = {
      timestamp = Time.now();
      totalValue;
      blueChipValue;
      midCapValue;
      lowCapValue;
    };

    let currentHistory = switch (principalMap.get(performanceHistory, caller)) {
      case (?history) history;
      case null [];
    };

    let updatedHistory = Array.append(currentHistory, [snapshot]);
    performanceHistory := principalMap.put(performanceHistory, caller, updatedHistory);
  };

  public query ({ caller }) func getPerformanceHistory() : async ?[PortfolioPerformance] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view performance history");
    };
    principalMap.get(performanceHistory, caller);
  };

  // UI Preferences - User can only access their own preferences
  public shared ({ caller }) func updateUIPreferences(preferences : UIPreferences) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can update UI preferences");
    };
    uiPreferences := principalMap.put(uiPreferences, caller, preferences);
  };

  public query ({ caller }) func getUIPreferences() : async ?UIPreferences {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view UI preferences");
    };
    principalMap.get(uiPreferences, caller);
  };

  // Exit Strategy Management - User can only access their own strategies
  public shared ({ caller }) func addExitStrategy(strategy : ExitStrategy) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can add exit strategies");
    };

    let currentStrategies = switch (principalMap.get(exitStrategies, caller)) {
      case (?strategies) strategies;
      case null [];
    };

    let updatedStrategies = Array.append(currentStrategies, [strategy]);
    exitStrategies := principalMap.put(exitStrategies, caller, updatedStrategies);
  };

  public query ({ caller }) func getExitStrategies() : async ?[ExitStrategy] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view exit strategies");
    };
    principalMap.get(exitStrategies, caller);
  };

  public query ({ caller }) func getExitLadderForAsset(asset : Text) : async ?[ExitStrategy] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view exit ladders");
    };
    switch (principalMap.get(exitStrategies, caller)) {
      case (?strategies) {
        let filtered = Array.filter<ExitStrategy>(
          strategies,
          func(strategy) {
            strategy.asset == asset;
          },
        );
        ?filtered;
      };
      case null null;
    };
  };

  public query ({ caller }) func calculateTotalPortfolioValue() : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can calculate portfolio value");
    };

    let holdings = switch (principalMap.get(userPortfolios, caller)) {
      case (?h) h;
      case null [];
    };

    var totalValue : Float = 0.0;
    for (holding in holdings.vals()) {
      totalValue += holding.quantity * holding.purchasePrice;
    };

    totalValue;
  };

  public query ({ caller }) func calculateExitLadder(asset : Text, averageCost : Float, multipliers : [Float], sellPercentages : [Float], isBase : Bool) : async [ExitStrategy] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can calculate exit ladders");
    };

    var strategies : [ExitStrategy] = [];
    var i = 0;
    for (multiplier in multipliers.vals()) {
      let targetPrice = if (isBase) {
        (averageCost * 1.1) * multiplier;
      } else {
        averageCost * multiplier;
      };

      let sellPercentage = if (i < sellPercentages.size()) {
        sellPercentages[i];
      } else {
        0.0;
      };

      let strategy : ExitStrategy = {
        asset;
        targetPrice;
        sellPercentage;
        basePrice = averageCost;
        isBase;
      };

      strategies := Array.append(strategies, [strategy]);
      i += 1;
    };

    strategies;
  };

  // Default UI Preferences for Portfolio Mode - requires authentication
  public query ({ caller }) func getDefaultPortfolioColumns() : async [Text] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can access default settings");
    };
    [
      "Ticker",
      "Quantity",
      "Purchase Price",
      "Current Price",
      "Value",
      "Change 24h",
      "Market Cap",
      "Volume 24h",
      "Category",
      "Ladder",
      "Notes",
    ];
  };

  // Default Blue Chip Conservative Ladder - requires authentication
  public query ({ caller }) func getDefaultBlueChipConservativeLadder() : async [LadderRung] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can access default ladder presets");
    };
    [
      { multiplier = 1.2; sellPercent = 10.0 },
      { multiplier = 1.4; sellPercent = 20.0 },
      { multiplier = 1.8; sellPercent = 25.0 },
      { multiplier = 2.0; sellPercent = 40.0 },
      { multiplier = 0.0; sellPercent = 5.0 },
    ];
  };

  // Default Mid Cap Aggressive Ladder - requires authentication
  public query ({ caller }) func getDefaultMidCapAggressiveLadder() : async [LadderRung] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can access default ladder presets");
    };
    [
      { multiplier = 2.0; sellPercent = 10.0 },
      { multiplier = 3.0; sellPercent = 20.0 },
      { multiplier = 5.0; sellPercent = 25.0 },
      { multiplier = 10.0; sellPercent = 40.0 },
      { multiplier = 0.0; sellPercent = 5.0 },
    ];
  };

  // Default Mid Cap Conservative Ladder - requires authentication
  public query ({ caller }) func getDefaultMidCapConservativeLadder() : async [LadderRung] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can access default ladder presets");
    };
    [
      { multiplier = 2.0; sellPercent = 40.0 },
      { multiplier = 3.0; sellPercent = 25.0 },
      { multiplier = 5.0; sellPercent = 20.0 },
      { multiplier = 10.0; sellPercent = 10.0 },
      { multiplier = 0.0; sellPercent = 5.0 },
    ];
  };

  // Default Low Cap Aggressive Ladder - requires authentication
  public query ({ caller }) func getDefaultLowCapAggressiveLadder() : async [LadderRung] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can access default ladder presets");
    };
    [
      { multiplier = 2.0; sellPercent = 10.0 },
      { multiplier = 3.0; sellPercent = 20.0 },
      { multiplier = 5.0; sellPercent = 25.0 },
      { multiplier = 10.0; sellPercent = 40.0 },
      { multiplier = 0.0; sellPercent = 5.0 },
    ];
  };

  // Default Low Cap Conservative Ladder - requires authentication
  public query ({ caller }) func getDefaultLowCapConservativeLadder() : async [LadderRung] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can access default ladder presets");
    };
    [
      { multiplier = 2.0; sellPercent = 40.0 },
      { multiplier = 3.0; sellPercent = 25.0 },
      { multiplier = 5.0; sellPercent = 20.0 },
      { multiplier = 10.0; sellPercent = 10.0 },
      { multiplier = 0.0; sellPercent = 5.0 },
    ];
  };

  // Calculate Remaining Percentage - requires authentication
  public query ({ caller }) func calculateRemainingPercentage(percentages : [Float]) : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can calculate remaining percentages");
    };
    var total : Float = 0.0;
    for (percentage in percentages.vals()) {
      total += percentage;
    };
    100.0 - total;
  };

  // Calculate Exit Ladder with Remaining Percentage - requires authentication
  public query ({ caller }) func calculateExitLadderWithRemaining(asset : Text, averageCost : Float, multipliers : [Float], sellPercentages : [Float], isBase : Bool) : async [ExitStrategy] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can calculate exit ladders");
    };

    var strategies : [ExitStrategy] = [];
    var i = 0;
    for (multiplier in multipliers.vals()) {
      let targetPrice = if (isBase) {
        (averageCost * 1.1) * multiplier;
      } else {
        averageCost * multiplier;
      };

      let sellPercentage = if (i < sellPercentages.size()) {
        sellPercentages[i];
      } else {
        0.0;
      };

      let strategy : ExitStrategy = {
        asset;
        targetPrice;
        sellPercentage;
        basePrice = averageCost;
        isBase;
      };

      strategies := Array.append(strategies, [strategy]);
      i += 1;
    };

    // Add remaining percentage as a separate strategy with multiplier 0
    let totalPercentage = Array.foldLeft<Float, Float>(
      sellPercentages,
      0.0,
      func(acc, percentage) {
        acc + percentage;
      },
    );

    let remainingPercentage = 100.0 - totalPercentage;
    if (remainingPercentage > 0.0) {
      let remainingStrategy : ExitStrategy = {
        asset;
        targetPrice = averageCost;
        sellPercentage = remainingPercentage;
        basePrice = averageCost;
        isBase;
      };
      strategies := Array.append(strategies, [remainingStrategy]);
    };

    strategies;
  };

  // New function to update exit strategies
  public shared ({ caller }) func updateExitStrategies(strategies : [ExitStrategy]) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can update exit strategies");
    };
    exitStrategies := principalMap.put(exitStrategies, caller, strategies);
  };

  // New function to get all exit strategies for a user
  public query ({ caller }) func getAllExitStrategies() : async ?[ExitStrategy] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view all exit strategies");
    };
    principalMap.get(exitStrategies, caller);
  };
};

