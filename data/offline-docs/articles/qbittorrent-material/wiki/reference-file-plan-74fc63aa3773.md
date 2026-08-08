# Repository File Plan

```json
[
  {
    "path": "CMakeLists.txt",
    "kind": "cmake",
    "purpose": "Root project: Qt6/Boost/OpenSSL/libtorrent/zlib min versions, feature options (GUI/WEBUI/DBUS/PLUGINS), add src subdir",
    "feature": "build"
  },
  {
    "path": "cmake/Modules/FindLibtorrentRasterbar.cmake",
    "kind": "cmake",
    "purpose": "Locate libtorrent-rasterbar (LT1/LT2) for the engine layer",
    "feature": "build"
  },
  {
    "path": "src/CMakeLists.txt",
    "kind": "cmake",
    "purpose": "Build qbt_base static engine lib + qbittorrent executable via qt_add_executable/qt_add_qml_module (Quick, QuickControls2)",
    "feature": "build"
  },
  {
    "path": "src/main.cpp",
    "kind": "cpp-source",
    "purpose": "Entry point: force Material style, init Application/engine singletons, load Main.qml",
    "feature": "app"
  },
  {
    "path": "src/app/application.h",
    "kind": "cpp-header",
    "purpose": "Application/IGUIApplication facade: engine init/teardown, QML type registration, app context object",
    "feature": "app"
  },
  {
    "path": "src/app/application.cpp",
    "kind": "cpp-source",
    "purpose": "Application impl: file logger, startup window state, test email, instance name, QML bootstrap",
    "feature": "app"
  },
  {
    "path": "src/app/appcontroller.h",
    "kind": "cpp-header",
    "purpose": "Top-level UI actions: exit/close/minimize-to-tray, UI lock/unlock, update check, paste-add, power mgmt",
    "feature": "app"
  },
  {
    "path": "src/app/appcontroller.cpp",
    "kind": "cpp-source",
    "purpose": "AppController implementation and window-behavior logic",
    "feature": "app"
  },
  {
    "path": "src/app/desktopintegration.h",
    "kind": "cpp-header",
    "purpose": "System tray icon + notifications + tray/dock menu state, activation and lock gating",
    "feature": "app"
  },
  {
    "path": "src/app/desktopintegration.cpp",
    "kind": "cpp-source",
    "purpose": "DesktopIntegration impl (QSystemTrayIcon, DBus/native notifications)",
    "feature": "app"
  },
  {
    "path": "src/base/bittorrent/session.h",
    "kind": "cpp-header",
    "purpose": "Abstract Session facade over libtorrent (all BT/network settings, torrents(), signals)",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/sessionimpl.h",
    "kind": "cpp-header",
    "purpose": "Concrete SessionImpl declaration with CachedSettingValue members for every setting key",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/sessionimpl.cpp",
    "kind": "cpp-source",
    "purpose": "SessionImpl: libtorrent session on IO thread, invoke/invokeAsync, state refresh, add/remove/queue",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrent.h",
    "kind": "cpp-header",
    "purpose": "Abstract Torrent interface: accessors, state predicates, actions, async fetchers",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrentimpl.h",
    "kind": "cpp-header",
    "purpose": "Concrete TorrentImpl: content handler overrides, move-storage/maintenance enums",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrentimpl.cpp",
    "kind": "cpp-source",
    "purpose": "TorrentImpl implementation over libtorrent torrent_handle",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrentcontenthandler.h",
    "kind": "cpp-header",
    "purpose": "Base for content pane: files/priorities/rename/progress + signals",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrentcontenthandler.cpp",
    "kind": "cpp-source",
    "purpose": "TorrentContentHandler shared rename-folder logic",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrentinfo.h",
    "kind": "cpp-header",
    "purpose": "Immutable metadata wrapper (files, pieces, hashes)",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrentinfo.cpp",
    "kind": "cpp-source",
    "purpose": "TorrentInfo implementation over lt::torrent_info",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrentdescriptor.h",
    "kind": "cpp-header",
    "purpose": "Add-source abstraction (file/magnet/raw), expected<> factories",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrentdescriptor.cpp",
    "kind": "cpp-source",
    "purpose": "TorrentDescriptor parse/load/save implementation",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/peerinfo.h",
    "kind": "cpp-header",
    "purpose": "Per-peer row model source for Peers tab",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/peerinfo.cpp",
    "kind": "cpp-source",
    "purpose": "PeerInfo implementation over lt::peer_info",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/trackerentry.h",
    "kind": "cpp-header",
    "purpose": "TrackerEntry{url,tier} + parseTrackerEntries",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/trackerentrystatus.h",
    "kind": "cpp-header",
    "purpose": "TrackerEntryStatus/TrackerEndpointStatus/TrackerEndpointState for Trackers tab",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/addtorrentparams.h",
    "kind": "cpp-header",
    "purpose": "AddTorrentParams struct (tri-state optionals) + serialize/parse",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/addtorrentparams.cpp",
    "kind": "cpp-source",
    "purpose": "AddTorrentParams JSON (de)serialization",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/sharelimits.h",
    "kind": "cpp-header",
    "purpose": "ShareLimits struct + ShareLimitAction/Mode enums with persisted numeric values",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/categoryoptions.h",
    "kind": "cpp-header",
    "purpose": "CategoryOptions + DownloadPathOption",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/categoryoptions.cpp",
    "kind": "cpp-source",
    "purpose": "CategoryOptions JSON mapping",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/infohash.h",
    "kind": "cpp-header",
    "purpose": "InfoHash/TorrentID identity types",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/infohash.cpp",
    "kind": "cpp-source",
    "purpose": "InfoHash/TorrentID implementation",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/downloadpriority.h",
    "kind": "cpp-header",
    "purpose": "DownloadPriority enum + helpers",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrentcontentlayout.h",
    "kind": "cpp-header",
    "purpose": "TorrentContentLayout + TorrentContentRemoveOption enums",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/sessionstatus.h",
    "kind": "cpp-header",
    "purpose": "SessionStatus + CacheStatus structs for status bar/statistics/speed",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrentcreator.h",
    "kind": "cpp-header",
    "purpose": "TorrentCreator QRunnable + params/result + calculateTotalPieces",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/torrentcreator.cpp",
    "kind": "cpp-source",
    "purpose": "TorrentCreator implementation",
    "feature": "engine"
  },
  {
    "path": "src/base/bittorrent/sslparameters.h",
    "kind": "cpp-header",
    "purpose": "SSLParameters + PeerAddress helper types",
    "feature": "engine"
  },
  {
    "path": "src/base/torrentfileguard.h",
    "kind": "cpp-header",
    "purpose": "Deferred .torrent delete guard + AutoDeleteMode",
    "feature": "engine"
  },
  {
    "path": "src/base/torrentfileguard.cpp",
    "kind": "cpp-source",
    "purpose": "TorrentFileGuard implementation",
    "feature": "engine"
  },
  {
    "path": "src/base/preferences.h",
    "kind": "cpp-header",
    "purpose": "Preferences singleton: all UI/app settings getters/setters, changed()/apply()",
    "feature": "engine"
  },
  {
    "path": "src/base/preferences.cpp",
    "kind": "cpp-source",
    "purpose": "Preferences implementation with exact setting keys",
    "feature": "engine"
  },
  {
    "path": "src/base/settingvalue.h",
    "kind": "cpp-header",
    "purpose": "SettingValue/CachedSettingValue templates",
    "feature": "engine"
  },
  {
    "path": "src/base/settingsstorage.h",
    "kind": "cpp-header",
    "purpose": "SettingsStorage key/value backing store",
    "feature": "engine"
  },
  {
    "path": "src/base/settingsstorage.cpp",
    "kind": "cpp-source",
    "purpose": "SettingsStorage implementation",
    "feature": "engine"
  },
  {
    "path": "src/base/logger.h",
    "kind": "cpp-header",
    "purpose": "Logger ring buffers + Log::Msg/Log::Peer + MsgType flags",
    "feature": "engine"
  },
  {
    "path": "src/base/logger.cpp",
    "kind": "cpp-source",
    "purpose": "Logger implementation",
    "feature": "engine"
  },
  {
    "path": "src/base/torrentfileswatcher.h",
    "kind": "cpp-header",
    "purpose": "Watched-folders engine with WatchedFolderOptions",
    "feature": "engine"
  },
  {
    "path": "src/base/torrentfileswatcher.cpp",
    "kind": "cpp-source",
    "purpose": "TorrentFilesWatcher implementation",
    "feature": "engine"
  },
  {
    "path": "src/base/utils/misc.h",
    "kind": "cpp-header",
    "purpose": "friendlyUnit/userFriendlyDuration/isPreviewable/version strings + SizeUnit",
    "feature": "engine"
  },
  {
    "path": "src/base/utils/misc.cpp",
    "kind": "cpp-source",
    "purpose": "Utils::Misc implementation (exact formatting rules)",
    "feature": "engine"
  },
  {
    "path": "src/base/utils/string.h",
    "kind": "cpp-header",
    "purpose": "fromDouble (floor), wildcardToRegexPattern, fromEnum/toEnum, joinIntoString",
    "feature": "engine"
  },
  {
    "path": "src/base/utils/string.cpp",
    "kind": "cpp-source",
    "purpose": "Utils::String implementation",
    "feature": "engine"
  },
  {
    "path": "src/base/utils/password.h",
    "kind": "cpp-header",
    "purpose": "PBKDF2 generate/verify for UI lock + WebUI password",
    "feature": "engine"
  },
  {
    "path": "src/base/utils/net.h",
    "kind": "cpp-header",
    "purpose": "parseIPRange/parseSubnet/Subnet + SMTP/SSL cert helpers",
    "feature": "engine"
  },
  {
    "path": "src/base/utils/fs/path.h",
    "kind": "cpp-header",
    "purpose": "Path value type used across engine",
    "feature": "engine"
  },
  {
    "path": "src/base/unicodestrings.h",
    "kind": "cpp-header",
    "purpose": "C_INFINITY/C_COPYRIGHT/C_INEQUALITY constants",
    "feature": "engine"
  },
  {
    "path": "src/base/tagset.h",
    "kind": "cpp-header",
    "purpose": "Tag/TagSet types",
    "feature": "engine"
  },
  {
    "path": "src/base/types.h",
    "kind": "cpp-header",
    "purpose": "ShutdownDialogAction, WindowState, shared enums",
    "feature": "engine"
  },
  {
    "path": "src/base/net/downloadmanager.h",
    "kind": "cpp-header",
    "purpose": "DownloadManager: download(), cookies, hasSupportedScheme",
    "feature": "engine-net"
  },
  {
    "path": "src/base/net/downloadmanager.cpp",
    "kind": "cpp-source",
    "purpose": "DownloadManager implementation",
    "feature": "engine-net"
  },
  {
    "path": "src/base/net/proxyconfigurationmanager.h",
    "kind": "cpp-header",
    "purpose": "Proxy config manager + ProxyType/ProxyConfiguration",
    "feature": "engine-net"
  },
  {
    "path": "src/base/net/portforwarder.h",
    "kind": "cpp-header",
    "purpose": "UPnP/NAT-PMP port forwarder enable/disable",
    "feature": "engine-net"
  },
  {
    "path": "src/base/net/smtpclient.h",
    "kind": "cpp-header",
    "purpose": "SMTP client + SMTPEncryptionType for mail notifications",
    "feature": "engine-net"
  },
  {
    "path": "src/base/net/dnsupdater.h",
    "kind": "cpp-header",
    "purpose": "Dynamic DNS updater + Service enum + registration URL",
    "feature": "engine-net"
  },
  {
    "path": "src/base/net/geoipmanager.h",
    "kind": "cpp-header",
    "purpose": "Peer country resolution (DB-IP)",
    "feature": "engine-net"
  },
  {
    "path": "src/base/net/reverseresolution.h",
    "kind": "cpp-header",
    "purpose": "Reverse hostname resolution for Peers tab",
    "feature": "engine-net"
  },
  {
    "path": "src/base/search/searchpluginmanager.h",
    "kind": "cpp-header",
    "purpose": "Plugin manager singleton (install/enable/update/categories) + signals",
    "feature": "engine-search"
  },
  {
    "path": "src/base/search/searchpluginmanager.cpp",
    "kind": "cpp-source",
    "purpose": "SearchPluginManager implementation (Python plugins)",
    "feature": "engine-search"
  },
  {
    "path": "src/base/search/searchhandler.h",
    "kind": "cpp-header",
    "purpose": "Per-query handler (nova2.py process, streamed results, timeout) + SearchResult",
    "feature": "engine-search"
  },
  {
    "path": "src/base/search/searchhandler.cpp",
    "kind": "cpp-source",
    "purpose": "SearchHandler implementation",
    "feature": "engine-search"
  },
  {
    "path": "src/base/search/searchdownloadhandler.h",
    "kind": "cpp-header",
    "purpose": "nova2dl.py download handler",
    "feature": "engine-search"
  },
  {
    "path": "src/base/rss/rss_session.h",
    "kind": "cpp-header",
    "purpose": "RSS::Session singleton (feeds/folders CRUD, refresh, settings)",
    "feature": "engine-rss"
  },
  {
    "path": "src/base/rss/rss_session.cpp",
    "kind": "cpp-source",
    "purpose": "RSS::Session implementation",
    "feature": "engine-rss"
  },
  {
    "path": "src/base/rss/rss_item.h",
    "kind": "cpp-header",
    "purpose": "RSS::Item abstract tree node + path helpers",
    "feature": "engine-rss"
  },
  {
    "path": "src/base/rss/rss_folder.h",
    "kind": "cpp-header",
    "purpose": "RSS::Folder aggregate node",
    "feature": "engine-rss"
  },
  {
    "path": "src/base/rss/rss_feed.h",
    "kind": "cpp-header",
    "purpose": "RSS::Feed (url/title/icon/state/refresh interval)",
    "feature": "engine-rss"
  },
  {
    "path": "src/base/rss/rss_feed.cpp",
    "kind": "cpp-source",
    "purpose": "RSS::Feed fetch/parse implementation",
    "feature": "engine-rss"
  },
  {
    "path": "src/base/rss/rss_article.h",
    "kind": "cpp-header",
    "purpose": "RSS::Article value type + data() keys",
    "feature": "engine-rss"
  },
  {
    "path": "src/base/rss/rss_autodownloader.h",
    "kind": "cpp-header",
    "purpose": "AutoDownloader singleton (rules CRUD, import/export, smart filter)",
    "feature": "engine-rss"
  },
  {
    "path": "src/base/rss/rss_autodownloader.cpp",
    "kind": "cpp-source",
    "purpose": "AutoDownloader implementation + matching",
    "feature": "engine-rss"
  },
  {
    "path": "src/base/rss/rss_autodownloadrule.h",
    "kind": "cpp-header",
    "purpose": "AutoDownloadRule value type + matches()/accepts()",
    "feature": "engine-rss"
  },
  {
    "path": "src/base/rss/rss_autodownloadrule.cpp",
    "kind": "cpp-source",
    "purpose": "Rule serialization + episode/smart-filter matching",
    "feature": "engine-rss"
  },
  {
    "path": "src/quick/theme/thememanager.h",
    "kind": "cpp-header",
    "purpose": "ThemeManager: color scheme, named-color resolution w/ JSON override, tray style, themeChanged",
    "feature": "theme"
  },
  {
    "path": "src/quick/theme/thememanager.cpp",
    "kind": "cpp-source",
    "purpose": "ThemeManager implementation + default Primer color table",
    "feature": "theme"
  },
  {
    "path": "src/quick/theme/iconprovider.h",
    "kind": "cpp-header",
    "purpose": "Legacy icon id -> Material Symbols codepoint map + flag QQuickImageProvider",
    "feature": "theme"
  },
  {
    "path": "src/quick/theme/iconprovider.cpp",
    "kind": "cpp-source",
    "purpose": "IconProvider/FlagImageProvider implementation",
    "feature": "theme"
  },
  {
    "path": "src/quick/painteditems/piecesbaritem.h",
    "kind": "cpp-header",
    "purpose": "PiecesBar QQuickPaintedItem (downloaded + availability modes)",
    "feature": "properties"
  },
  {
    "path": "src/quick/painteditems/piecesbaritem.cpp",
    "kind": "cpp-source",
    "purpose": "PiecesBar painting implementation",
    "feature": "properties"
  },
  {
    "path": "src/quick/models/transferlistmodel.h",
    "kind": "cpp-header",
    "purpose": "TransferListModel QAbstractListModel (one role per column, state colors/icons/formatting)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/models/transferlistmodel.cpp",
    "kind": "cpp-source",
    "purpose": "TransferListModel implementation + engine signal wiring",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/models/torrentfilterproxymodel.h",
    "kind": "cpp-header",
    "purpose": "Sort/filter proxy with TorrentFilter + two-level sort",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/models/torrentfilterproxymodel.cpp",
    "kind": "cpp-source",
    "purpose": "Proxy compare()/filter implementation",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/models/torrentfilter.h",
    "kind": "cpp-header",
    "purpose": "TorrentFilter (status+category+tag+tracker+announce) ANDed match",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/models/statusfiltermodel.h",
    "kind": "cpp-header",
    "purpose": "Status filter rows with live counts + hide-zero",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/models/categoryfiltermodel.h",
    "kind": "cpp-header",
    "purpose": "Category tree filter model (All/Uncategorized + nested)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/models/tagfiltermodel.h",
    "kind": "cpp-header",
    "purpose": "Tag filter list model (All/Untagged)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/models/trackersfiltermodel.h",
    "kind": "cpp-header",
    "purpose": "Trackers filter list model with favicons + counts",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/models/trackerstatusfiltermodel.h",
    "kind": "cpp-header",
    "purpose": "Separate tracker-status filter model",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/controllers/transfercontroller.h",
    "kind": "cpp-header",
    "purpose": "Transfer actions: start/stop/queue/category/tag/recheck/reannounce/export/copy/drag-add",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/controllers/transfercontroller.cpp",
    "kind": "cpp-source",
    "purpose": "TransferController implementation",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/controllers/propertiescontroller.h",
    "kind": "cpp-header",
    "purpose": "Holds current torrent, per-tab dynamic refresh, general-tab formatted fields",
    "feature": "properties"
  },
  {
    "path": "src/quick/controllers/propertiescontroller.cpp",
    "kind": "cpp-source",
    "purpose": "PropertiesController implementation",
    "feature": "properties"
  },
  {
    "path": "src/quick/models/peerlistmodel.h",
    "kind": "cpp-header",
    "purpose": "Peers table model (fetchPeerInfo, country/host resolution)",
    "feature": "properties"
  },
  {
    "path": "src/quick/models/trackerlistmodel.h",
    "kind": "cpp-header",
    "purpose": "Hierarchical tracker model + sticky DHT/PeX/LSD rows + sort proxy",
    "feature": "properties"
  },
  {
    "path": "src/quick/models/trackerlistmodel.cpp",
    "kind": "cpp-source",
    "purpose": "TrackerListModel implementation + announce-time refresh",
    "feature": "properties"
  },
  {
    "path": "src/quick/models/webseedlistmodel.h",
    "kind": "cpp-header",
    "purpose": "HTTP sources list model (fetchURLSeeds)",
    "feature": "properties"
  },
  {
    "path": "src/quick/models/torrentcontentmodel.h",
    "kind": "cpp-header",
    "purpose": "Content tree model (checkbox/priority/progress/availability) + filter proxy",
    "feature": "content"
  },
  {
    "path": "src/quick/models/torrentcontentmodel.cpp",
    "kind": "cpp-source",
    "purpose": "TorrentContentModel implementation over TorrentContentHandler",
    "feature": "content"
  },
  {
    "path": "src/quick/models/speedplotmodel.h",
    "kind": "cpp-header",
    "purpose": "Speed plot data: 10 series, averagers, period selection",
    "feature": "properties"
  },
  {
    "path": "src/quick/controllers/addtorrentcontroller.h",
    "kind": "cpp-header",
    "purpose": "Add dialog controller wrapping TorrentDescriptor+AddTorrentParams + content adaptor",
    "feature": "addtorrent"
  },
  {
    "path": "src/quick/controllers/addtorrentcontroller.cpp",
    "kind": "cpp-source",
    "purpose": "AddTorrentController + TorrentContentAdaptor + metadata updates",
    "feature": "addtorrent"
  },
  {
    "path": "src/quick/controllers/guiaddtorrentmanager.h",
    "kind": "cpp-header",
    "purpose": "Decides skip/show dialog, URL download, duplicate-merge handling",
    "feature": "addtorrent"
  },
  {
    "path": "src/quick/controllers/addtorrentparamscontroller.h",
    "kind": "cpp-header",
    "purpose": "Tri-state defaults editor reused by RSS rules/category/watched folders",
    "feature": "addtorrent"
  },
  {
    "path": "src/quick/controllers/optionscontroller.h",
    "kind": "cpp-header",
    "purpose": "Load/validate/save all 9 options tabs against Session/Preferences/Net/Theme",
    "feature": "options"
  },
  {
    "path": "src/quick/controllers/optionscontroller.cpp",
    "kind": "cpp-source",
    "purpose": "OptionsController implementation",
    "feature": "options"
  },
  {
    "path": "src/quick/models/watchedfoldersmodel.h",
    "kind": "cpp-header",
    "purpose": "Watched-folders list model over TorrentFilesWatcher",
    "feature": "options"
  },
  {
    "path": "src/quick/models/advancedsettingsmodel.h",
    "kind": "cpp-header",
    "purpose": "Flat key/value advanced settings list grouped qBittorrent/libtorrent",
    "feature": "options"
  },
  {
    "path": "src/quick/controllers/searchcontroller.h",
    "kind": "cpp-header",
    "purpose": "Search tabs, history/session persistence, Python guard",
    "feature": "search"
  },
  {
    "path": "src/quick/controllers/searchcontroller.cpp",
    "kind": "cpp-source",
    "purpose": "SearchController implementation",
    "feature": "search"
  },
  {
    "path": "src/quick/models/searchresultsmodel.h",
    "kind": "cpp-header",
    "purpose": "Results model + sort/filter proxy (size/seeds/name/visited)",
    "feature": "search"
  },
  {
    "path": "src/quick/models/searchpluginsmodel.h",
    "kind": "cpp-header",
    "purpose": "Installed-plugins model (name/version/url/enabled/favicon)",
    "feature": "search"
  },
  {
    "path": "src/quick/controllers/rsscontroller.h",
    "kind": "cpp-header",
    "purpose": "RSS tab controller (mark read, refresh, add feed/folder, filter)",
    "feature": "rss"
  },
  {
    "path": "src/quick/controllers/rsscontroller.cpp",
    "kind": "cpp-source",
    "purpose": "RSSController implementation",
    "feature": "rss"
  },
  {
    "path": "src/quick/models/rssfeedtreemodel.h",
    "kind": "cpp-header",
    "purpose": "Feeds tree model with sticky All/Unread virtual nodes",
    "feature": "rss"
  },
  {
    "path": "src/quick/models/rssarticlemodel.h",
    "kind": "cpp-header",
    "purpose": "Articles list model (read/unread, filter)",
    "feature": "rss"
  },
  {
    "path": "src/quick/models/autodownloadrulesmodel.h",
    "kind": "cpp-header",
    "purpose": "Rules list model + matching-articles preview source",
    "feature": "rss"
  },
  {
    "path": "src/quick/controllers/ruleeditorcontroller.h",
    "kind": "cpp-header",
    "purpose": "Rule definition editing + validation + live matching preview",
    "feature": "rss"
  },
  {
    "path": "src/quick/controllers/executionlogcontroller.h",
    "kind": "cpp-header",
    "purpose": "Execution log controller + message-type toggles",
    "feature": "log"
  },
  {
    "path": "src/quick/models/logmodels.h",
    "kind": "cpp-header",
    "purpose": "LogMessageModel/LogPeerModel ring buffers + LogFilterProxy",
    "feature": "log"
  },
  {
    "path": "src/quick/models/logmodels.cpp",
    "kind": "cpp-source",
    "purpose": "Log models implementation",
    "feature": "log"
  },
  {
    "path": "src/quick/controllers/statisticscontroller.h",
    "kind": "cpp-header",
    "purpose": "Statistics dialog data from SessionStatus/CacheStatus",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/controllers/torrentcreatorcontroller.h",
    "kind": "cpp-header",
    "purpose": "Torrent creator flow (threadpool, progress, seed on finish)",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/controllers/torrentcreatorcontroller.cpp",
    "kind": "cpp-source",
    "purpose": "TorrentCreatorController implementation",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/models/cookiesmodel.h",
    "kind": "cpp-header",
    "purpose": "Editable cookies table model over DownloadManager",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/controllers/speedlimitcontroller.h",
    "kind": "cpp-header",
    "purpose": "Global/alt speed limit read/write for SpeedLimitDialog + status bar",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/qml/Main.qml",
    "kind": "qml",
    "purpose": "ApplicationWindow shell: menu bar, toolbar, central tabs, status bar, tray, title/close/minimize behavior",
    "feature": "mainwindow"
  },
  {
    "path": "src/quick/qml/theme/qmldir",
    "kind": "config",
    "purpose": "Declares Theme module singletons",
    "feature": "theme"
  },
  {
    "path": "src/quick/qml/theme/Theme.qml",
    "kind": "qml",
    "purpose": "Color singleton: Material role scheme + extended roles + named-id color() resolver",
    "feature": "theme"
  },
  {
    "path": "src/quick/qml/theme/Typography.qml",
    "kind": "qml",
    "purpose": "Type scale singleton (Roboto/Roboto Mono)",
    "feature": "theme"
  },
  {
    "path": "src/quick/qml/theme/Spacing.qml",
    "kind": "qml",
    "purpose": "Spacing/radius/elevation tokens singleton",
    "feature": "theme"
  },
  {
    "path": "src/quick/qml/theme/Icons.qml",
    "kind": "qml",
    "purpose": "Material Symbols codepoint map singleton (legacy id -> glyph)",
    "feature": "theme"
  },
  {
    "path": "src/quick/qml/theme/StateColors.qml",
    "kind": "qml",
    "purpose": "TorrentState -> color id + icon id + status string maps",
    "feature": "theme"
  },
  {
    "path": "src/quick/qml/components/qmldir",
    "kind": "config",
    "purpose": "Declares reusable Components module",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/MDIcon.qml",
    "kind": "qml",
    "purpose": "Renders a Material Symbols glyph (size/color/fill/weight)",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/IconButton.qml",
    "kind": "qml",
    "purpose": "Flat Material icon button with tooltip",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/MaterialCard.qml",
    "kind": "qml",
    "purpose": "Elevated card container for grouped content",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/SectionHeader.qml",
    "kind": "qml",
    "purpose": "Title label + optional divider",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/CollapsibleSection.qml",
    "kind": "qml",
    "purpose": "Expandable header section for filter sidebar (persists expanded state)",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/CheckableGroupBox.qml",
    "kind": "qml",
    "purpose": "Material expandable card with header Switch enabling/disabling body",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/LabeledField.qml",
    "kind": "qml",
    "purpose": "Label + control row used across forms",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/PathField.qml",
    "kind": "qml",
    "purpose": "TextField + folder picker (FileSystemPathLineEdit)",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/PathComboField.qml",
    "kind": "qml",
    "purpose": "History combo + folder picker (FileSystemPathComboEdit)",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/SpeedSpinBox.qml",
    "kind": "qml",
    "purpose": "SpinBox with sentinel textFromValue (infinity/disabled/Never/system default)",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/TriStateComboField.qml",
    "kind": "qml",
    "purpose": "Default/Yes/No combo mapping to std::optional<bool>",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/FilterTextField.qml",
    "kind": "qml",
    "purpose": "Search field with clear + regex-toggle context menu + FilterPatternFormatMenu",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/FilterPatternFormatMenu.qml",
    "kind": "qml",
    "purpose": "PlainText/Wildcards/Regex exclusive menu (patternFormatChanged)",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/DataTable.qml",
    "kind": "qml",
    "purpose": "HeaderView+TableView wrapper: sort, right-align, header menu, persisted state",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/ColumnHeaderMenu.qml",
    "kind": "qml",
    "purpose": "Column visibility menu (last-column guard) + Resize columns",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/ProgressCell.qml",
    "kind": "qml",
    "purpose": "Progress bar + centered % label with disabled-state styling",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/Snackbar.qml",
    "kind": "qml",
    "purpose": "Material snackbar for in-app notifications",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/ConfirmDialog.qml",
    "kind": "qml",
    "purpose": "Reusable confirmation dialog (remember/don't-ask-again)",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/TextInputDialog.qml",
    "kind": "qml",
    "purpose": "One-line text prompt (AutoExpandableDialog equivalent)",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/SharedShareLimitsForm.qml",
    "kind": "qml",
    "purpose": "Reusable TorrentShareLimitsWidget (ratio/seeding/inactive/mode/action)",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/components/AddTorrentParamsForm.qml",
    "kind": "qml",
    "purpose": "Reusable AddTorrentParamsWidget (TMM/paths/category/tags/layout/start/queue/share limits)",
    "feature": "components"
  },
  {
    "path": "src/quick/qml/mainwindow/AppMenuBar.qml",
    "kind": "qml",
    "purpose": "File/Edit/View/Tools/Plugins/Help menu bar with all actions, shortcuts, checkable/dynamic items",
    "feature": "mainwindow"
  },
  {
    "path": "src/quick/qml/mainwindow/AppToolBar.qml",
    "kind": "qml",
    "purpose": "Top toolbar with actions, stretch, filter widget + filter-by combo, text-position style",
    "feature": "mainwindow"
  },
  {
    "path": "src/quick/qml/mainwindow/ToolbarContextMenu.qml",
    "kind": "qml",
    "purpose": "Toolbar text-position exclusive menu (icons/text/beside/under/follow)",
    "feature": "mainwindow"
  },
  {
    "path": "src/quick/qml/mainwindow/AppStatusBar.qml",
    "kind": "qml",
    "purpose": "Status bar: free space, external IP, DHT, connection, alt-speed, dl/up speed buttons",
    "feature": "mainwindow"
  },
  {
    "path": "src/quick/qml/mainwindow/CentralTabs.qml",
    "kind": "qml",
    "purpose": "Auto-hiding TabBar + StackLayout for Transfers/Search/RSS/Execution Log",
    "feature": "mainwindow"
  },
  {
    "path": "src/quick/qml/mainwindow/SystemTrayMenu.qml",
    "kind": "qml",
    "purpose": "Tray/dock menu (show-hide, add, alt-speed, resume/pause, exit)",
    "feature": "mainwindow"
  },
  {
    "path": "src/quick/qml/mainwindow/ExitConfirmationDialog.qml",
    "kind": "qml",
    "purpose": "3-button exit confirmation (No/Yes/Always Yes)",
    "feature": "mainwindow"
  },
  {
    "path": "src/quick/qml/mainwindow/UILockScreen.qml",
    "kind": "qml",
    "purpose": "Lock overlay + unlock password prompt",
    "feature": "mainwindow"
  },
  {
    "path": "src/quick/qml/mainwindow/LockPasswordDialog.qml",
    "kind": "qml",
    "purpose": "Set/Clear UI lock password dialog",
    "feature": "mainwindow"
  },
  {
    "path": "src/quick/qml/transferlist/TransfersTab.qml",
    "kind": "qml",
    "purpose": "SplitView: filter sidebar + (transfer list over properties)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/TransferListView.qml",
    "kind": "qml",
    "purpose": "Main torrent DataTable with all columns, progress/name delegates, selection, drag-drop, dbl-click",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/TransferRowContextMenu.qml",
    "kind": "qml",
    "purpose": "Full row context menu (start/stop/remove/location/rename/AutoTMM/options/etc.)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/CategorySubMenu.qml",
    "kind": "qml",
    "purpose": "Category submenu (New/Reset + checkable categories)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/TagsSubMenu.qml",
    "kind": "qml",
    "purpose": "Tags submenu (Add/Remove All + tri-state tags)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/QueueSubMenu.qml",
    "kind": "qml",
    "purpose": "Queue submenu (top/up/down/bottom)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/CopySubMenu.qml",
    "kind": "qml",
    "purpose": "Copy submenu (name/hash v1/v2/magnet/id/comment/content path)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/FilterSidebar.qml",
    "kind": "qml",
    "purpose": "Scrollable collapsible sidebar container of filter sections",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/StatusFilterPanel.qml",
    "kind": "qml",
    "purpose": "Status filter list with counts + icons",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/StatusFilterMenu.qml",
    "kind": "qml",
    "purpose": "Status filter context menu (start/force/stop/remove visible)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/CategoryFilterTree.qml",
    "kind": "qml",
    "purpose": "Category tree filter with All/Uncategorized + counts",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/CategoryFilterMenu.qml",
    "kind": "qml",
    "purpose": "Category filter context menu (add/edit/remove/unused + visible actions)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/TagFilterList.qml",
    "kind": "qml",
    "purpose": "Tag filter list with All/Untagged + counts",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/TagFilterMenu.qml",
    "kind": "qml",
    "purpose": "Tag filter context menu (add/remove/unused + visible actions)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/TrackersFilterList.qml",
    "kind": "qml",
    "purpose": "Trackers filter list with favicons/special rows/counts",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/TrackersFilterMenu.qml",
    "kind": "qml",
    "purpose": "Trackers filter context menu (remove tracker + visible actions)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/TrackerStatusFilterPanel.qml",
    "kind": "qml",
    "purpose": "Separate tracker-status filter panel (All/Warning/Tracker error/Other error)",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/transferlist/TransferColumnMenu.qml",
    "kind": "qml",
    "purpose": "Transfer-list header column-visibility menu wrapper",
    "feature": "transferlist"
  },
  {
    "path": "src/quick/qml/properties/PropertiesPanel.qml",
    "kind": "qml",
    "purpose": "Stacked properties container + PropTabBar with collapse-on-reclick",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/GeneralTab.qml",
    "kind": "qml",
    "purpose": "Pieces bars card + Transfer card + Information card (label/value grid)",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/TrackersTab.qml",
    "kind": "qml",
    "purpose": "Tracker tree table + tier up/down buttons + context menu",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/PeersTab.qml",
    "kind": "qml",
    "purpose": "Peers table + context menu (add/copy/ban)",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/HttpSourcesTab.qml",
    "kind": "qml",
    "purpose": "Web seeds list + context menu (add/remove/copy/edit)",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/ContentTab.qml",
    "kind": "qml",
    "purpose": "Content tree + Select All/None + filter line",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/SpeedTab.qml",
    "kind": "qml",
    "purpose": "Speed graph or disabled placeholder + period combo + graph toggle",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/DownloadedPiecesBar.qml",
    "kind": "qml",
    "purpose": "Downloaded-pieces bar wrapper over PiecesBar item",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/PieceAvailabilityBar.qml",
    "kind": "qml",
    "purpose": "Availability bar wrapper over PiecesBar item",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/SpeedPlotView.qml",
    "kind": "qml",
    "purpose": "Live line chart (10 series, legend, y-scale, grid)",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/dialogs/AddPeersDialog.qml",
    "kind": "qml",
    "purpose": "Add peers (one per line) dialog",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/dialogs/AddTrackersDialog.qml",
    "kind": "qml",
    "purpose": "Add trackers dialog with uTorrent list URL download",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/dialogs/EditTrackerDialog.qml",
    "kind": "qml",
    "purpose": "Edit single tracker URL dialog",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/dialogs/AddWebSeedDialog.qml",
    "kind": "qml",
    "purpose": "Add web seed URL dialog",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/dialogs/EditWebSeedDialog.qml",
    "kind": "qml",
    "purpose": "Edit web seed URL dialog",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/properties/dialogs/RenameFileDialog.qml",
    "kind": "qml",
    "purpose": "Rename single content file/folder dialog",
    "feature": "properties"
  },
  {
    "path": "src/quick/qml/content/TorrentContentTree.qml",
    "kind": "qml",
    "purpose": "Reusable content tree table (checkbox/priority/progress/availability) + context menu",
    "feature": "content"
  },
  {
    "path": "src/quick/qml/content/ContentPriorityDelegate.qml",
    "kind": "qml",
    "purpose": "Priority combobox cell delegate",
    "feature": "content"
  },
  {
    "path": "src/quick/qml/content/ContentTreeContextMenu.qml",
    "kind": "qml",
    "purpose": "Content tree context menu (open/rename/batch/priority)",
    "feature": "content"
  },
  {
    "path": "src/quick/qml/content/BatchRenameDialog.qml",
    "kind": "qml",
    "purpose": "Manage Torrent Content (batch rename) dialog",
    "feature": "content"
  },
  {
    "path": "src/quick/qml/addtorrent/AddNewTorrentDialog.qml",
    "kind": "qml",
    "purpose": "Add New Torrent dialog: options panel + content tree split, metadata, save-as",
    "feature": "addtorrent"
  },
  {
    "path": "src/quick/qml/torrentoptions/TorrentOptionsDialog.qml",
    "kind": "qml",
    "purpose": "Multi-torrent options edit (TMM/paths/category/speed/share/DHT-PEX-LSD/sequential)",
    "feature": "torrent-options"
  },
  {
    "path": "src/quick/qml/categories/CategoryDialog.qml",
    "kind": "qml",
    "purpose": "Add/Edit category dialog (name/save path/download path/share limits)",
    "feature": "categories-tags"
  },
  {
    "path": "src/quick/qml/tags/TorrentTagsDialog.qml",
    "kind": "qml",
    "purpose": "Torrent tags dialog (flow of checkboxes + add tag)",
    "feature": "categories-tags"
  },
  {
    "path": "src/quick/qml/tags/AddTagDialog.qml",
    "kind": "qml",
    "purpose": "Inline add-tag input dialog",
    "feature": "categories-tags"
  },
  {
    "path": "src/quick/qml/options/OptionsDialog.qml",
    "kind": "qml",
    "purpose": "Options shell: nav list + page StackLayout + OK/Cancel/Apply",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/BehaviorPage.qml",
    "kind": "qml",
    "purpose": "Behavior tab (interface/transfer list/desktop/power/log)",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/DownloadsPage.qml",
    "kind": "qml",
    "purpose": "Downloads tab (add behavior/saving/watched folders/excluded/mail/autorun)",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/ConnectionPage.qml",
    "kind": "qml",
    "purpose": "Connection tab (protocol/port/limits/I2P/proxy/IP filter)",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/SpeedPage.qml",
    "kind": "qml",
    "purpose": "Speed tab (global/alt limits/scheduler/rate settings)",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/BitTorrentPage.qml",
    "kind": "qml",
    "purpose": "BitTorrent tab (privacy/queueing/seeding limits/trackers)",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/RSSPage.qml",
    "kind": "qml",
    "purpose": "RSS tab (reader/auto downloader/smart filter)",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/WebUIPage.qml",
    "kind": "qml",
    "purpose": "WebUI tab (server/HTTPS/auth/API key/alt UI/security/DynDNS)",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/AdvancedPage.qml",
    "kind": "qml",
    "purpose": "Advanced settings list grouped qBittorrent/libtorrent with (?) doc links",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/WatchedFolderOptionsDialog.qml",
    "kind": "qml",
    "purpose": "Watched folder options (recursive + torrent params)",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/BanListOptionsDialog.qml",
    "kind": "qml",
    "purpose": "Manage banned IPs dialog",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/IPSubnetWhitelistDialog.qml",
    "kind": "qml",
    "purpose": "Whitelisted IP subnets dialog",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/UIThemeDialog.qml",
    "kind": "qml",
    "purpose": "UI Theme customization dialog",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/options/APIKeyConfirmDialog.qml",
    "kind": "qml",
    "purpose": "Generate/rotate/delete API key confirmation dialog",
    "feature": "options-dialog"
  },
  {
    "path": "src/quick/qml/search/SearchTab.qml",
    "kind": "qml",
    "purpose": "Search bar (pattern/category/plugin scope/search-stop) + results tab area or empty page",
    "feature": "search"
  },
  {
    "path": "src/quick/qml/search/SearchNoPluginsPage.qml",
    "kind": "qml",
    "purpose": "No-plugins empty page",
    "feature": "search"
  },
  {
    "path": "src/quick/qml/search/SearchResultsTab.qml",
    "kind": "qml",
    "purpose": "Results filter bar + results table (SearchJobWidget)",
    "feature": "search"
  },
  {
    "path": "src/quick/qml/search/SearchResultsContextMenu.qml",
    "kind": "qml",
    "purpose": "Results context menu (download window/download/open desc/copy)",
    "feature": "search"
  },
  {
    "path": "src/quick/qml/search/SearchTabContextMenu.qml",
    "kind": "qml",
    "purpose": "Results tab-bar context menu (refresh/stop/close/close all)",
    "feature": "search"
  },
  {
    "path": "src/quick/qml/search/SearchPluginsDialog.qml",
    "kind": "qml",
    "purpose": "Search plugins management dialog (list/install/update/close, drag-drop)",
    "feature": "search"
  },
  {
    "path": "src/quick/qml/search/PluginContextMenu.qml",
    "kind": "qml",
    "purpose": "Plugin enable/uninstall context menu",
    "feature": "search"
  },
  {
    "path": "src/quick/qml/search/PluginSourceDialog.qml",
    "kind": "qml",
    "purpose": "Plugin source picker (Local file / Web link)",
    "feature": "search"
  },
  {
    "path": "src/quick/qml/search/NewPluginUrlDialog.qml",
    "kind": "qml",
    "purpose": "New search engine plugin URL input dialog",
    "feature": "search"
  },
  {
    "path": "src/quick/qml/rss/RSSTab.qml",
    "kind": "qml",
    "purpose": "RSS 3-pane split (feeds/articles/preview) + toolbar + warning banner",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/rss/RSSToolbar.qml",
    "kind": "qml",
    "purpose": "RSS toolbar (new sub/mark read/update all/filter/downloader)",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/rss/FeedsTree.qml",
    "kind": "qml",
    "purpose": "Feeds tree with sticky All/Unread nodes, icons, drag-drop",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/rss/FeedsContextMenu.qml",
    "kind": "qml",
    "purpose": "Feeds context menu (update/mark read/rename/options/delete/new/copy URL)",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/rss/ArticlesList.qml",
    "kind": "qml",
    "purpose": "Articles list (read/unread styling, mark-read on navigate)",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/rss/ArticlesContextMenu.qml",
    "kind": "qml",
    "purpose": "Articles context menu (download torrent/open news URL)",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/rss/ArticlePreview.qml",
    "kind": "qml",
    "purpose": "HTML article preview (header block + body, torrent/magnet anchor handling)",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/rss/RSSFeedDialog.qml",
    "kind": "qml",
    "purpose": "RSS Feed Options dialog (URL + refresh interval)",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/rss/AutomatedDownloadRulesDialog.qml",
    "kind": "qml",
    "purpose": "RSS Downloader dialog: rules list + rule def + feeds + matching preview + import/export",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/rss/RuleDefinitionPanel.qml",
    "kind": "qml",
    "purpose": "Rule editor (priority/regex/must/mustnot/episode/smart/ignore + torrent params)",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/rss/MatchingArticlesPreview.qml",
    "kind": "qml",
    "purpose": "Matching RSS articles tree preview",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/rss/RulesListContextMenu.qml",
    "kind": "qml",
    "purpose": "Rules list context menu (add/delete/rename/clone/clear episodes)",
    "feature": "rss"
  },
  {
    "path": "src/quick/qml/log/ExecutionLogTab.qml",
    "kind": "qml",
    "purpose": "Execution log tabbed view (General + Blocked IPs, East tab position)",
    "feature": "log"
  },
  {
    "path": "src/quick/qml/log/GeneralLogView.qml",
    "kind": "qml",
    "purpose": "General log list (colored time+message, copy/clear)",
    "feature": "log"
  },
  {
    "path": "src/quick/qml/log/BlockedIPsView.qml",
    "kind": "qml",
    "purpose": "Blocked IPs log list",
    "feature": "log"
  },
  {
    "path": "src/quick/qml/log/LogContextMenu.qml",
    "kind": "qml",
    "purpose": "Log copy/clear context menu",
    "feature": "log"
  },
  {
    "path": "src/quick/qml/dialogs/StatisticsDialog.qml",
    "kind": "qml",
    "purpose": "Statistics dialog (user/cache/performance/tracker groups, live update)",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/qml/dialogs/AboutDialog.qml",
    "kind": "qml",
    "purpose": "About dialog (6 tabs: about/authors/thanks/translators/license/software)",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/qml/dialogs/TorrentCreatorDialog.qml",
    "kind": "qml",
    "purpose": "Torrent Creator dialog (source/settings/fields/progress/create)",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/qml/dialogs/SpeedLimitDialog.qml",
    "kind": "qml",
    "purpose": "Global speed limits dialog (normal + alternative, slider+spin)",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/qml/dialogs/CookiesDialog.qml",
    "kind": "qml",
    "purpose": "Manage cookies dialog (editable table + add/delete)",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/qml/dialogs/DownloadFromURLDialog.qml",
    "kind": "qml",
    "purpose": "Download from URLs dialog (multiline + clipboard auto-paste)",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/qml/dialogs/TrackerEntriesDialog.qml",
    "kind": "qml",
    "purpose": "Edit trackers dialog (tier-grouped text)",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/qml/dialogs/DeletionConfirmationDialog.qml",
    "kind": "qml",
    "purpose": "Remove torrent(s) confirmation (also-delete-content + remember)",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/qml/dialogs/PreviewSelectDialog.qml",
    "kind": "qml",
    "purpose": "Preview file selection dialog (previewable files table)",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/qml/dialogs/ShutdownConfirmDialog.qml",
    "kind": "qml",
    "purpose": "Shutdown/exit/suspend/hibernate/reboot confirm with countdown",
    "feature": "dialogs"
  },
  {
    "path": "src/quick/qml/qmldir",
    "kind": "config",
    "purpose": "Root qBittorrent QML module manifest (feature folders)",
    "feature": "build"
  },
  {
    "path": "resources/resources.qrc",
    "kind": "qrc",
    "purpose": "Qt resource bundle: Material Symbols font, flag SVGs, tray icons, html assets",
    "feature": "build"
  },
  {
    "path": "resources/fonts/MaterialSymbolsOutlined.ttf",
    "kind": "resource",
    "purpose": "Bundled Material Symbols variable font for icon glyphs",
    "feature": "theme"
  },
  {
    "path": "resources/icons/flags/README.md",
    "kind": "resource",
    "purpose": "Placeholder for reused 369 country flag SVGs referenced by ISO code",
    "feature": "theme"
  },
  {
    "path": "resources/html/gpl.html",
    "kind": "resource",
    "purpose": "License text asset for About dialog",
    "feature": "dialogs"
  },
  {
    "path": "docs/ARCHITECTURE.md",
    "kind": "doc",
    "purpose": "Layer boundaries, engine/bridge/view contracts, signal flow",
    "feature": "docs"
  },
  {
    "path": "docs/DESIGN_SYSTEM.md",
    "kind": "doc",
    "purpose": "Material color roles, named-id mapping, typography, icons, components",
    "feature": "docs"
  },
  {
    "path": "docs/ENGINE_API.md",
    "kind": "doc",
    "purpose": "Preserved BitTorrent/RSS/Search engine API contract + setting keys",
    "feature": "docs"
  },
  {
    "path": "docs/PORTING_NOTES.md",
    "kind": "doc",
    "purpose": "Widgets->QML mapping, persisted-key compatibility, tri-state semantics",
    "feature": "docs"
  },
  {
    "path": "README.md",
    "kind": "doc",
    "purpose": "Project overview, build instructions, feature flags",
    "feature": "docs"
  },
  {
    "path": ".clang-format",
    "kind": "config",
    "purpose": "C++ formatting config for engine + bridge layers",
    "feature": "build"
  }
]
```
