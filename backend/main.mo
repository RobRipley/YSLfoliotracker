import OrderedMap "mo:base/OrderedMap";
import Array "mo:base/Array";
import Text "mo:base/Text";
import Float "mo:base/Float";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Principal "mo:base/Principal";
import Debug "mo:base/Debug";
import OutCall "http-outcalls/outcall";
import AccessControl "authorization/access-control";

actor CryptoPortfolioTracker {

  // Initialize the access control system
  let accessControlState = AccessControl.initState();

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
    name : Text;
    email : ?Text;
    createdAt : Int;
  };

  transient let principalMap = OrderedMap.Make<Principal>(Principal.compare);
  var userProfiles = principalMap.empty<UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
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

  // Data structures using Principal as key instead of Text
  var userPortfolios = principalMap.empty<[Holding]>();
  var adminSettings = principalMap.empty<AdminSettings>();
  var performanceHistory = principalMap.empty<[PortfolioPerformance]>();
  var uiPreferences = principalMap.empty<UIPreferences>();
  var exitStrategies = principalMap.empty<[ExitStrategy]>();

  // Market data cache is shared across all users (public read access)
  transient let textMap = OrderedMap.Make<Text>(Text.compare);
  var marketDataCache : OrderedMap.Map<Text, [MarketAsset]> = textMap.empty<[MarketAsset]>();

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

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
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

  // Market Data Functions - Authenticated users can fetch and access market data
  public shared ({ caller }) func fetchCoinGeckoData(endpoint : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can fetch market data");
    };
    let url = "https://api.coingecko.com/api/v3/" # endpoint;
    await OutCall.httpGetRequest(url, [], transform);
  };

  public shared ({ caller }) func getMarketData(endpoint : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can access market data");
    };
    let url = "https://api.coingecko.com/api/v3/" # endpoint;
    await OutCall.httpGetRequest(url, [], transform);
  };

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

