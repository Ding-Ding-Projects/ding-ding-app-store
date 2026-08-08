# ENGINE_API.md — Engine API Surface (authoritative for signatures)

**Status:** NORMATIVE for exact engine signatures. Where this file and
`CONTRACTS.md` disagree on a signature, **`src/base/**.h` and this file win**
(per CONTRACTS §0). Bridge/UI teams `#include` the real headers and code against
the signatures documented here. The engine preserves qBittorrent's class/method
names, persisted setting keys, and **enum numeric values** for config
compatibility.

This document summarizes the engine surface produced by the *engine-headers-aux*
team — the **Net**, **Search**, and **RSS** subsystems — and cross-references the
BitTorrent core (`Session`/`Torrent`/`Preferences`, fully specified in
`CONTRACTS.md §6`).

### Cross-cutting conventions

- **Namespaces:** `Net`, `RSS`, `Search`-adjacent (search types are in the global
  namespace, matching upstream), `BitTorrent`, `Utils`.
- **Singletons:** engine singletons expose `static T *instance()` (some also
  `initInstance()`/`freeInstance()`). They are **not** QML types; a bridge
  controller/model wraps each for QML and shares the same instance.
- **Async:** subscribe to Qt signals — **never poll**. HTTP results arrive via
  `Net::DownloadHandler::finished`; per-torrent detail reads return `QFuture<T>`
  bridged with `QFutureWatcher` (CONTRACTS §7.3).
- **Logging:** every lifecycle step/state change/alert/error is logged via the
  categorized `lcNet` / `lcRss` / `lcSearch` categories (CONTRACTS §3).
- **Headers:** `#pragma once`, GPLv3 / `SPDX-License-Identifier: GPL-3.0-or-later`,
  C++20.

---

## 1. Net — `src/base/net/`

### 1.1 `Net::DownloadManager` — `downloadmanager.h`

Singleton HTTP(S) client. Owns the shared `QNetworkAccessManager`, cookie jar, and
per-service sequential queues.

```cpp
static void initInstance(); static void freeInstance();
static DownloadManager *instance();

DownloadHandler *download(const DownloadRequest &request, bool useProxy);
template <typename Context, typename Func>
void download(const DownloadRequest &request, bool useProxy, Context context, Func &&slot);

void registerSequentialService(const ServiceID &serviceID, std::chrono::seconds delay = {});

QList<QNetworkCookie> cookiesForUrl(const QUrl &url) const;
bool setCookiesFromUrl(const QList<QNetworkCookie> &cookies, const QUrl &url);
QList<QNetworkCookie> allCookies() const;
void setAllCookies(const QList<QNetworkCookie> &cookies);
bool deleteCookie(const QNetworkCookie &cookie);
static bool hasSupportedScheme(const QString &url);
```

Supporting types:

- **`DownloadRequest`** — fluent value builder: `.url()`, `.userAgent()`,
  `.limit(qint64 bytes)` (`0` = unlimited), `.saveToFile(bool)`,
  `.destFileName(Path)`.
- **`DownloadResult`** — `{ QString url; DownloadStatus status; QString errorString;
  QByteArray data; Path filePath; QString magnetURI; }`.
- **`DownloadStatus`** — `Success`, `RedirectedToMagnet`, `Failed`.
- **`DownloadHandler : QObject`** — `virtual void cancel()`, signal
  `finished(const DownloadResult &)`. Owned by the manager; auto-deletes after finish.
- **`ServiceID`** — `{ QString hostName; int port; }`, `static fromURL(const QUrl&)`;
  hashable, used to serialize/rate-limit same-host requests.

Bridged by: `DownloadManager` consumers across RSS/Search/GeoIP; the **Cookies**
options tab uses the cookie API (`CookiesModel`).

### 1.2 `Net::ProxyConfigurationManager` — `proxyconfigurationmanager.h`

```cpp
static void initInstance(); static void freeInstance();
static ProxyConfigurationManager *instance();
ProxyConfiguration proxyConfiguration() const;
void setProxyConfiguration(const ProxyConfiguration &config);
signals: void proxyConfigurationChanged();
```

- **`ProxyConfiguration`** — `{ ProxyType type; QString ip; ushort port = 8080;
  bool authEnabled; QString username, password; bool hostnameLookupEnabled = true; }`
  with `operator==`/`operator!=`.
- **`Net::ProxyType`** (`proxytype.h`, persisted values — do not renumber):
  `None = 0`, `HTTP = 1`, `SOCKS5 = 2`, `SOCKS4 = 5` (`Q_ENUM_NS`).

Bridged by: `OptionsController` (Connection → Proxy tab).

### 1.3 `Net::PortForwarder` — `portforwarder.h`

Abstract UPnP/NAT-PMP service (implementation backed by the libtorrent session).

```cpp
static PortForwarder *instance();
virtual bool isEnabled() const = 0;   virtual void setEnabled(bool) = 0;
virtual void setPorts(const QString &profile, QSet<quint16> ports) = 0;
virtual void removePorts(const QString &profile) = 0;
```

Ports are grouped by named `profile` so subsystems map/unmap independently.

### 1.4 `Net::SMTPClient` — `smtpclient.h`

Fire-and-forget SMTP sender for the "email on completion" feature.

```cpp
static void sendMail(const QString &from, const QString &to,
                     const QString &subject, const QString &body,
                     QObject *context = nullptr);
```

Default ports: `SMTP_DEFAULT_PORT = 25`, `_SSL = 465`, `_STARTTLS = 587`.
Encryption enum (`smtpencryptiontype.h`, persisted): `Net::SMTPEncryptionType {
None = 0, STARTTLS = 1, SMTPS = 2 }`. Reads mail settings from `Preferences`.

### 1.5 `Net::DNSUpdater` — `dnsupdater.h`

Dynamic-DNS updater (DynDNS/No-IP protocol). Not a singleton — one instance owned by
the session/app when the feature is enabled.

```cpp
explicit DNSUpdater(QObject *parent = nullptr);
static QUrl getRegistrationUrl(DNS::Service service);
public slots: void updateCredentials();   // re-read service/domain/creds from Preferences
```

`DNS::Service` is defined in `base/preferences.h`. Bridged by: `OptionsController`
(Advanced → Dynamic DNS).

### 1.6 `Net::GeoIPManager` — `geoipmanager.h`

```cpp
static void initInstance(); static void freeInstance();
static GeoIPManager *instance();
QString lookup(const QHostAddress &hostAddr) const;   // -> ISO 3166-1 alpha-2 or ""
static QString CountryName(const QString &countryISOCode);
```

Auto-downloads/updates the local MaxMind DB when enabled. Feeds the peer list's
country column; QML renders flags via `image://flags/<isoCode>`
(`FlagImageProvider`), **not** Material icons (CONTRACTS §4.5).

### 1.7 `Net::ReverseResolution` — `reverseresolution.h`

```cpp
static void initInstance(); static void freeInstance();
static ReverseResolution *instance();
QString resolve(const QHostAddress &ip);   // cached; "" while a lookup is queued
signals: void ipResolved(const QHostAddress &ip, const QString &hostname);
```

Peer list "resolve host names" option; subscribe to `ipResolved` and refresh the
affected rows.

---

## 2. Search — `src/base/search/`

Python-driven ("nova") search engine plugins spawned as child processes.

### 2.1 `SearchPluginManager` — `searchpluginmanager.h`

Global-namespace singleton.

```cpp
static SearchPluginManager *instance();   static void freeInstance();

QStringList allPlugins() const;
QStringList enabledPlugins() const;
QStringList supportedCategories() const;
QStringList getPluginCategories(const QString &pluginName) const;
SearchPluginInfo *pluginInfo(const QString &name) const;
QString pluginNameBySiteURL(const QString &siteURL) const;

void enablePlugin(const QString &name, bool enabled = true);
void updatePlugin(const QString &name);
void installPlugin(const QString &source);   // local path or URL
bool uninstallPlugin(const QString &name);
void checkForUpdates();

SearchHandler *startSearch(const QString &pattern, const QString &category,
                           const QStringList &usedPlugins);
SearchDownloadHandler *downloadTorrent(const QString &pluginName, const QString &url);

QProcessEnvironment proxyEnvironment() const;
static QString categoryFullName(const QString &categoryName);
QString pluginFullName(const QString &pluginName) const;
static Path pluginsLocation();   static Path engineLocation();
static SearchPluginVersion getPluginVersion(const Path &filePath);
```

Signals: `pluginEnabled(name, enabled)`, `pluginInstalled(name)`,
`pluginInstallationFailed(name, reason)`, `pluginUninstalled(name)`,
`pluginUpdated(name)`, `pluginUpdateFailed(name, reason)`,
`checkForUpdatesFinished(QHash<QString, SearchPluginVersion>)`,
`checkForUpdatesFailed(reason)`.

- **`SearchPluginInfo`** — `{ QString name; SearchPluginVersion version; QString
  fullName; QString url; QStringList supportedCategories; Path iconPath; bool
  enabled; }`.
- **`SearchPluginVersion`** = `Utils::Version<2>` (major.minor).

Bridged by: `SearchController` + `SearchPluginsModel`.

### 2.2 `SearchHandler` — `searchhandler.h`

Created only via `SearchPluginManager::startSearch()`.

```cpp
bool isActive() const;   QString pattern() const;
SearchPluginManager *manager() const;
QList<SearchResult> results() const;
void cancelSearch();
signals:
    void searchFinished(bool cancelled = false);
    void searchFailed(const QString &errorMessage);
    void newSearchResults(const QList<SearchResult> &results);   // streamed incrementally
```

- **`SearchResult`** — `{ QString fileName, fileUrl; qlonglong fileSize, nbSeeders,
  nbLeechers; QString engineName, siteUrl, descrLink; QDateTime pubDate; }`.

Bridged by: `SearchResultsModel` (+ sort/filter proxy: size/seeds/name, visited flag).

### 2.3 `SearchDownloadHandler` — `searchdownloadhandler.h`

Created only via `SearchPluginManager::downloadTorrent()`.

```cpp
signals: void downloadFinished(const QString &path, const QString &errorMessage);
```

Resolves a result URL into a local `.torrent` (or magnet), then hand off to the
add-torrent flow.

---

## 3. RSS — `src/base/rss/`

A tree of `Item`s rooted at `RSS::Session`. `Folder` = branch, `Feed` = leaf holding
`Article`s. `AutoDownloader` matches new articles against `AutoDownloadRule`s.

### 3.1 `RSS::Session` — `rss_session.h`

Singleton; runs refreshes on a dedicated working thread.

```cpp
static Session *instance();

bool isProcessingEnabled() const;    void setProcessingEnabled(bool);
int  maxArticlesPerFeed() const;     void setMaxArticlesPerFeed(int);
int  refreshInterval() const;        void setRefreshInterval(int);      // minutes
std::chrono::seconds fetchDelay() const;   void setFetchDelay(std::chrono::seconds);

nonstd::expected<Folder *, QString> addFolder(const QString &path);
nonstd::expected<Feed *, QString>   addFeed(const QString &url, const QString &path,
                                            std::chrono::seconds refreshInterval = {});
nonstd::expected<void, QString> setFeedURL(const QString &path, const QString &url);
nonstd::expected<void, QString> setFeedURL(Feed *feed, const QString &url);
nonstd::expected<void, QString> moveItem(const QString &itemPath, const QString &destPath);
nonstd::expected<void, QString> moveItem(Item *item, const QString &destPath);
nonstd::expected<void, QString> removeItem(const QString &itemPath);

QList<Item *> items() const;   Item *itemByPath(const QString &path) const;
QList<Feed *> feeds() const;   Feed *feedByURL(const QString &url) const;
Folder *rootFolder() const;
```

Signals: `processingStateChanged(bool)`, `maxArticlesPerFeedChanged(int)`,
`itemAdded(Item*)`, `itemPathChanged(Item*)`, `itemAboutToBeRemoved(Item*)`,
`feedIconLoaded(Feed*)`, `feedStateChanged(Feed*)`,
`feedURLChanged(Feed*, oldURL)`.

> **Error handling:** mutating calls return `nonstd::expected<T, QString>`
> (`base/3rdparty/expected.hpp`); on failure the `QString` is a user-presentable,
> already-`tr`'d error. Controllers surface it via `Snackbar`/`ConfirmDialog`.

Bridged by: `RSSController` + `RSSFeedTreeModel` (sticky All/Unread nodes).

### 3.2 `RSS::Item` (abstract) — `rss_item.h`

```cpp
virtual QList<Article *> articles() const = 0;
virtual int  unreadCount() const = 0;
virtual void markAsRead() = 0;
virtual void refresh() = 0;
virtual void updateFetchDelay() = 0;
QString path() const;   QString name() const;
virtual QJsonValue toJsonValue(bool withData = false) const = 0;

static const QChar PathSeparator;                 // '\'
static bool     isValidPath(const QString &);
static QString  joinPath(const QString &, const QString &);
static QStringList expandPath(const QString &);
static QString  parentPath(const QString &);
static QString  relativeName(const QString &);
```

Signals: `pathChanged(Item*)`, `unreadCountChanged(Item*)`,
`aboutToBeDestroyed(Item*)`, `newArticle(Article*)`, `articleRead(Article*)`,
`articleAboutToBeRemoved(Article*)`.

### 3.3 `RSS::Folder` — `rss_folder.h`

`final : Item`. Aggregates children. Extra: `QList<Item *> items() const` (direct
children). The root of the tree is an unnamed `Folder`.

### 3.4 `RSS::Feed` — `rss_feed.h`

`final : Item`. Owns `Article`s.

```cpp
QUuid   uid() const;         QString url() const;
QString title() const;       QString lastBuildDate() const;
bool    hasError() const;    bool    isLoading() const;
Article *articleByGUID(const QString &guid) const;
Path    iconPath() const;
std::chrono::seconds refreshInterval() const;   void setRefreshInterval(std::chrono::seconds);
```

Signals: `iconLoaded(Feed*)`, `titleChanged(Feed*)`, `stateChanged(Feed*)`,
`urlChanged(oldURL)`, `refreshIntervalChanged(oldInterval)`.

### 3.5 `RSS::Article` — `rss_article.h`

`final : QObject`. Immutable value + read flag.

```cpp
Feed *feed() const;   QString guid() const;   QDateTime date() const;
QString title() const, author() const, description() const, torrentUrl() const, link() const;
bool isRead() const;  QVariantHash data() const;   void markAsRead();
static bool articleDateRecentThan(const Article *, const QDateTime &);
signals: void read(Article *article = nullptr);
```

Field keys (also the keys in `data()` used by rule matching): `KeyId`, `KeyDate`,
`KeyTitle`, `KeyAuthor`, `KeyDescription`, `KeyTorrentURL`, `KeyLink`, `KeyIsRead`.

Bridged by: `RSSArticleModel`.

### 3.6 `RSS::AutoDownloader` — `rss_autodownloader.h`

Singleton (`ApplicationComponent<QObject>`).

```cpp
enum class RulesFileFormat { Legacy, JSON };
static AutoDownloader *instance();

bool isProcessingEnabled() const;    void setProcessingEnabled(bool);
QStringList smartEpisodeFilters() const;   void setSmartEpisodeFilters(const QStringList &);
QRegularExpression smartEpisodeRegex() const;
bool downloadRepacks() const;        void setDownloadRepacks(bool);

bool hasRule(const QString &ruleName) const;
AutoDownloadRule ruleByName(const QString &ruleName) const;
QList<AutoDownloadRule> rules() const;
void setRule(const AutoDownloadRule &rule);
bool cloneRule(const QString &ruleName, const QString &cloneRuleName);
bool renameRule(const QString &ruleName, const QString &newRuleName);
void removeRule(const QString &ruleName);
QByteArray exportRules(RulesFileFormat = RulesFileFormat::JSON) const;
void importRules(const QByteArray &data, RulesFileFormat = RulesFileFormat::JSON);
```

Signals: `processingStateChanged(bool)`, `ruleAdded(name)`, `ruleChanged(name)`,
`ruleRenamed(name, oldName)`, `ruleAboutToBeRemoved(name)`. Throws `RSS::ParsingError`
on bad import data.

Bridged by: `AutoDownloadRulesModel` + `RuleEditorController`.

### 3.7 `RSS::AutoDownloadRule` — `rss_autodownloadrule.h`

Copy-on-write value type (`QSharedDataPointer`).

```cpp
explicit AutoDownloadRule(const QString &name = {});
QString name() const;                 void setName(const QString &);
bool isEnabled() const;               void setEnabled(bool);
int  priority() const;                void setPriority(int);
QString mustContain() const;          void setMustContain(const QString &);
QString mustNotContain() const;       void setMustNotContain(const QString &);
QStringList feedURLs() const;         void setFeedURLs(const QStringList &);
int  ignoreDays() const;              void setIgnoreDays(int);
QDateTime lastMatch() const;          void setLastMatch(const QDateTime &);
bool useRegex() const;                void setUseRegex(bool);
bool useSmartFilter() const;          void setUseSmartFilter(bool);
QString episodeFilter() const;        void setEpisodeFilter(const QString &);
QStringList previouslyMatchedEpisodes() const;
void setPreviouslyMatchedEpisodes(const QStringList &);
BitTorrent::AddTorrentParams addTorrentParams() const;
void setAddTorrentParams(BitTorrent::AddTorrentParams);

bool matches(const QVariantHash &articleData) const;   // pure — live editor preview
bool accepts(const QVariantHash &articleData);          // mutating — records match

QJsonObject toJsonObject() const;
static AutoDownloadRule fromJsonObject(const QJsonObject &, const QString &name = {});
QVariantHash toLegacyDict() const;
static AutoDownloadRule fromLegacyDict(const QVariantHash &);
friend bool operator==(const AutoDownloadRule &, const AutoDownloadRule &);
```

The rule's `AddTorrentParams` is edited with the shared `AddTorrentParamsForm`
(CONTRACTS §5.21) — the same reused by category/watched-folders/add-torrent.

---

## 4. BitTorrent core (cross-reference)

Fully specified in `CONTRACTS.md §6`. Summary for convenience:

- **`BitTorrent::Session`** — `static Session *instance()`; `torrents()`,
  `getTorrent(id)`, `addTorrent()`, `removeTorrent()`, row actions; signals
  `torrentsUpdated(QList<Torrent*>)`, `statsUpdated()`, `torrentAdded/Finished/…`.
  **Models react to `torrentsUpdated`/`statsUpdated`; never poll.**
- **`BitTorrent::Torrent`** — getters for every column; async detail reads return
  `QFuture<T>` (`fetchPeerInfo()`, `fetchURLSeeds()`, `fetchPieceAvailability()`,
  `fetchDownloadingPieces()`, `fetchAvailableFileFractions()`).
- **`BitTorrent::TorrentState`** — stable numeric enum (`-1`..`17`); QML maps the int
  to color via `StateColors.forState(state)`.
- **`Preferences`** — typed getters/setters + generic `value()/setValue()`;
  `changed()`/`apply()`. New key: `Appearance/Language` (int).

---

## 5. Consumption checklist (bridge/UI teams)

- [ ] `#include` the real `src/base/**` header; don't re-declare engine types.
- [ ] Get the singleton via `instance()`; share it with QML through a `create()`
      bridge (CONTRACTS §1.2), don't construct a second one.
- [ ] Connect to the documented signals; wrap `QFuture<T>` with `QFutureWatcher`
      (CONTRACTS §7.3). No timers/polling.
- [ ] Surface `nonstd::expected<...>` errors to the user (already `tr`'d) via
      `Snackbar`/`ConfirmDialog`; log via `lcNet`/`lcRss`/`lcSearch`.
- [ ] Respect persisted enum values — never renumber `ProxyType`,
      `SMTPEncryptionType`, `TorrentState`.
