# Reactor Realism Log · 反應堆寫實度日誌

The **Reactor** module (`feature/reactor-hyper`) is an incrementally-built, physically-faithful
Westinghouse 4-loop PWR simulation. Each entry below is one realism enhancement, researched and
implemented one run at a time. Newest first.

反應堆模組（`feature/reactor-hyper`）是逐步建構、貼近物理的西屋四迴路壓水式反應堆模擬。下列每條為一項
寫實度改進，每次研究並實作一項。最新在上。

---

## 2026-06-25 — Moisture Separator Reheater (MSR) — LP-steam drying/reheat + Baumann output credit · 汽水分離再熱器（MSR）——低壓蒸汽乾燥再熱連鮑曼出力修正

**Commit:** [`df8c02d`](https://github.com/codingmachineedge/WinForge/commit/df8c02d) on `feature/reactor-hyper`.

### What it models · 模擬內容

A PWR runs a **saturated-steam Rankine cycle**, so steam leaving the **high-pressure (HP) turbine** is very
wet (~11–13 % moisture). Left alone, that wetness would erode the long last-stage **low-pressure (LP)**
blades and waste output. Real plants fix this with two horizontal **Moisture Separator Reheater (MSR)**
shells between the HP and LP turbines: **chevron-vane moisture separators** mechanically strip the carryover
water (down to ~0.4 %), then a (typically two-stage) **reheater** — heated by HP extraction steam and main
throttle steam — adds **~80 °C of superheat**, lifting the **hot-reheat** temperature to **~265 °C** before
the steam enters the LP turbines. Drying + reheating the LP-inlet steam cuts **LP last-stage exhaust
moisture from ~13 % to ~9 %**, which both protects the blades (Baumann droplet-erosion limit ~12–15 %
wetness) and recovers roughly **1 % of gross electrical output** (the **Baumann rule**: ≈1 % efficiency lost
per 1 % mean stage moisture).

The model is a **self-contained, output-only block**. Each tick it reads only `SteamPressure`,
`FirstStagePressure` (load proxy) and the fault toggle, and writes only its own telemetry plus a clamped
`MsrOutputFactor` ∈ **[0.965, 1.01]** that multiplies the gross-MWe line as a **peer of the condenser-vacuum
correction**. It never touches primary state and never adds heat, so the meltdown-arm containment guarantee
is preserved. At very low load the reheater is cold (hot reheat collapses to LP-inlet saturation, no
superheat — the cold-startup behaviour). A default-**OFF** operator **reheater-tube-leak** fault drops hot
reheat ~35 °C, floods the drain tank, raises LP exhaust moisture toward the erosion alarm and trips the
low-reheat annunciator.

壓水堆行**飽和蒸汽朗肯循環**，故離開**高壓缸**嘅蒸汽好濕（約 11–13 % 濕度）。若唔處理，呢啲水滴會沖蝕又長
又脆嘅**低壓缸**末級葉片，亦浪費出力。真實電廠喺高低壓缸之間設兩台臥式**汽水分離再熱器（MSR）**：**波紋板
分離器**機械式除去帶水（降至約 0.4 %），再經（通常兩級）**再熱器**——由高壓抽汽同主蒸汽加熱——加入**約
80 °C 過熱度**，將**熱再熱蒸汽**升到**約 265 °C** 先送入低壓缸。乾燥兼再熱令**低壓末級排汽濕度由約 13 %
降至約 9 %**，既保護葉片（鮑曼水滴沖蝕限約 12–15 % 濕度），亦回收約**1 % 毛電出力**（**鮑曼定則**：每 1 %
級平均濕度約損失 1 % 效率）。

此模型為**自足、純出力**區塊：每步只讀 `SteamPressure`、`FirstStagePressure`（負載代理）同故障掣，只寫
自身遙測連一個受限嘅 `MsrOutputFactor` ∈ **[0.965, 1.01]**，以**與凝汽器真空修正同級**身份乘入毛電輸出。
唔會改動一次側、唔會加熱，保留熔毀武裝安全保證。極低負載時再熱器係凍嘅（熱再熱跌至低壓入口飽和、無過熱
——冷啟動行為）。預設**關閉**嘅操作員**再熱器傳熱管洩漏**故障會令熱再熱跌約 35 °C、疏水缸滿溢、低壓排汽
濕度升向沖蝕警報並觸發再熱低警報。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| HP-turbine exhaust (cold reheat) moisture · 高壓排汽（冷再熱）濕度 | ~12 % at full load · 滿負載約 12 % |
| Chevron separator efficiency / carryover · 波紋板分離效率／帶水 | η ≈ 0.965 → ~0.4 % out · 出口約 0.4 % |
| Heating-steam sat temp · 加熱蒸汽飽和溫度 | tSat(6.9 MPa) ≈ 289.9 °C (Horner fit) |
| Reheater terminal temp difference (TTD) · 再熱器端差 | 25 °C (15–30 °C band) → hot reheat ≈ 265 °C |
| LP-inlet saturation datum / superheat · 低壓入口飽和基準／過熱度 | 185 °C → ~80 °C superheat at full load |
| LP last-stage exhaust moisture · 低壓末級排汽濕度 | ~13 % no-reheat → ~9 % with MSR; ~10.7 % on tube leak |
| Baumann credit · 鮑曼修正 | ≈1 %/1 % mean moisture; `MsrOutputFactor` clamp [0.965, 1.01] |
| Tube-leak hot-reheat depression · 傳熱管洩漏熱再熱跌幅 | −35 °C (~265 → ~230 °C) |
| Alarm: high LP exhaust moisture · 警報：低壓排汽濕度高 | HI ≥ 13 % (HI-HI 14 % runback) |
| Alarm: low reheat · 警報：再熱低 | hot reheat < tSat−TTD−20 °C above 50 % load |
| Lags (first-order) · 一階時間常數 | HP moist 6 s · reheat 25 s · LP moist 10 s · factor 8 s · drain 15 s |

### Where it lives · 程式位置

`Services/ReactorSimService.cs`: `MsrStep(dt)` (single writer) + `MsrSatTempC(p)` Horner saturation helper,
called from `UpdateSecondary` just before `grossElec` (which now carries `× MsrOutputFactor`). Telemetry
gauges (hot-reheat temp, LP exhaust moisture, output-credit/drain), two annunciators
(`MsrHighLpMoisture`, `MsrLowReheat`) and a default-OFF **Reheater tube leak** toggle live in
`Pages/ReactorModule.xaml.cs` (Secondary & turbine section). All strings bilingual EN + 繁體中文/粵語.

---

## 2026-06-25 — Secondary calorimetric heat-balance power + Power-Range NIS calibration · 二次側熱平衡功率連功率量程核儀表校準

**Commit:** [`33f459e`](https://github.com/codingmachineedge/WinForge/commit/33f459e) on `feature/reactor-hyper`.

### What it models · 模擬內容

A real Westinghouse plant determines reactor thermal power not from the neutron detectors but from a
**secondary-side calorimetric heat balance** — the heat the steam generators actually remove —
and **calibrates the linear Power-Range NIS channels to it daily** (Tech-Spec SR 3.3.1.2: adjust the
channel whenever its indication deviates from the calorimetric by more than 2 % RTP). The heat balance is

> Q_SG = Σ_loops ṁ_fw·(h_steam − h_feedwater);  Q_fission = Q_SG − Q_RCP_pump-heat + Q_letdown/ambient-losses

Two physically-faithful behaviours fall out of this. First, the calorimetric **lags fast neutron
transients** (it is built from the slow, thermally-lagged feedwater flow and enthalpy rise) and is **gated
invalid below 15 % RTP**, where the small flow and small Δh make the balance unreliable. Second, over a fuel
cycle the uncompensated-ion-chamber Power-Range detectors lose sensitivity and the flux shape shifts, so the
**indicated** power-range reading drifts progressively **low** versus true fission power and must be
re-normalized to the calorimetric. That drift is modelled as a **deterministic gain error proportional to
core burnup accrued since the last calibration** (no RNG, no wall-clock — identical under the concurrent
scheduled runs), clamped to ±5 %. An operator **Calibrate PR** button (and a 24-h auto-cal) snapshots the
current burnup so the gain returns to 1.000. A **venturi ↔ LEFM** toggle models Measurement Uncertainty
Recapture: an ultrasonic LEFM tightens the calorimetric uncertainty from ~2.0 % to ~0.6 % RTP and licenses a
~101.7 % MUR uprate. **Display/indication only** — the reactor-trip logic still reads the true neutron power
fraction, never this drifted indication.

真實西屋電廠唔係靠中子探測器、而係靠**二次側熱平衡（calorimetric）**——即蒸發器實際帶走嘅熱量——嚟確定
反應堆熱功率，並**每日將線性功率量程核儀表校準至此熱平衡**（技術規範 SR 3.3.1.2：當指示偏離熱平衡超過
2 % 額定時須調整通道）。熱平衡為 Q_SG = Σ 給水流量×(蒸汽焓−給水焓)；裂變功率 = Q_SG − 主泵加熱 +
下泄／環境損失。由此自然得出兩個貼近物理嘅行為：其一，熱平衡係由緩慢、帶熱滯後嘅給水流量同焓升計出，故
**滯後於快中子暫態**，並喺 **15 % 額定以下判為無效**（流量同 Δh 太細，熱平衡唔可靠）。其二，經過一個燃料
循環，功率量程嘅非補償電離室靈敏度下降、通量形狀改變，令**指示**讀數相對真實裂變功率逐漸**偏低**，須重新
歸一化至熱平衡。此漂移以**隨上次校準以來累積燃耗成正比嘅確定性增益偏差**建模（無隨機數、無實時時鐘——
於並行排程運行下完全一致），鉗位 ±5 %。操作員**校準功率量程**掣（連 24 小時自動校準）會記錄當前燃耗，令
增益回到 1.000。**文丘里 ↔ LEFM** 切換模擬量測不確定度回收（MUR）：超聲波 LEFM 將熱平衡不確定度由約
2.0 % 收窄至約 0.6 % 額定，並許可約 101.7 % MUR 功率提升。**純指示用途**——停堆邏輯仍讀真實中子功率
分數，唔會讀此漂移指示。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Heat balance · 熱平衡 | Q_SG = Σ ṁ_fw·(h_steam − h_feedwater); Q_fission = Q_SG − Q_RCP + Q_losses |
| Steam enthalpy fit h_g(P) · 蒸汽焓擬合 | (−1.41515·P + 6.17848)·P + 2798.7442 kJ/kg, P in MPa (4–8 MPa, ≤0.55 kJ/kg) |
| Feedwater enthalpy fit h_f(T) · 給水焓擬合 | (0.00273551·T + 3.433719)·T + 56.04283 kJ/kg, T in °C (150–260 °C, ≤0.57 kJ/kg) |
| Rated point · 額定點 | 6.9 MPa, 226.7 °C → Δh ≈ 1799 kJ/kg → calorimetric closes to 100 % RTP |
| Net correction (RCP heat − losses) · 淨修正（主泵加熱−損失） | −0.20 % RTP (RCP ≈ +0.65 %, losses ≈ −0.45 %) |
| Calibration deviation threshold · 校準偏差門檻 | > 2.0 % RTP → recalibrate alarm (SR 3.3.1.2) |
| Validity gate · 有效門檻 | ≥ 15 % RTP (below: calorimetric invalid) |
| NIS drift model · 核儀表漂移模型 | gain = 1 − 2.0×10⁻⁶·(burnup − burnup_at_last_cal), clamped ±5 % |
| Drift over a cycle · 整個循環漂移 | ~−4 % at ~20 GWd/tU (≈ −2.7 % at the 18 GWd/tU cycle end) |
| Calorimetric uncertainty · 熱平衡不確定度 | venturi ≈ 2.0 % RTP vs LEFM ≈ 0.6 % RTP (1σ) |
| MUR uprate · MUR 提升 | LEFM → licensed 101.7 % RTP (recaptures the App-K 2 % FW margin) |
| Calibration cadence · 校準週期 | 24-h auto-cal + operator demand; protection reads true neutron power |

### Where it lives · 程式位置

`Services/ReactorSimService.cs` — `UpdateCalorimetric(dt)` + `CalibratePowerRangeToCalorimetric()`, the
`CalHgSteam`/`CalHfWater` enthalpy fits, and the `CalorimetricPowerPct` / `NisCalibrationGain` /
`NisCalorimetricDeviationPct` / `UseLefm` properties; `ReactorAlarm.NisCalorimetricDeviation`.
`Pages/ReactorModule.xaml(.cs)` — the **Secondary calorimetric · NIS calibration** readout panel in the
NIS/SPDS card, with the **Calibrate PR** button and the **Venturi/LEFM** toggle.

---

## 2026-06-25 — Digital inverse-point-kinetics reactivity computer (reactimeter) · 數位反向點動力學反應性計算機（反應性計）

**Commit:** [`cdf7761`](https://github.com/codingmachineedge/WinForge/commit/cdf7761) on `feature/reactor-hyper`.

### What it models · 模擬內容

A real plant **reactivity computer** (reactimeter) — the instrument used in startup physics testing to
**measure** control-rod worth, soluble-boron worth and moderator/isothermal temperature coefficients
(MTC/ITC), and in rod-drop / rod-swap / Dynamic Rod Worth Measurement. Crucially it reconstructs the net
core reactivity **purely from the measured neutron-flux signal n(t) alone**, by **inverting** the six-group
point-kinetics equations:

> ρ(t) = β_eff + (Λ\*/n)·(dn/dt − Σ_i λ_i C_i)

It **never reads the engine's internally-computed reactivity**. Instead it integrates its **own**
delayed-neutron precursor bank C_i from the flux history, using an analytic exponential integrator
(piecewise-linear source, L-stable and non-negative for any step) and a low-pass-filtered flux derivative
for the small prompt-jump term. Because it solves the kinetics independently, it **tracks but does not
exactly echo** the true ρ — a small, authentic dynamic lag during fast transients, exactly as a field
reactimeter behaves. That independence is the entire point: only a flux-driven instrument can *measure* an
unknown rod/boron worth, whereas an ρ-echo would merely replay the known input. It is seeded at the
assumed-critical steady state (C_i = β_i/(Λ\*·λ_i)·n) so it reads **ρ ≈ 0 at any equilibrium power**.

真實電廠嘅**反應性計算機**（反應性計）——起動物理試驗用嚟**量度**控制棒價值、可溶硼價值、慢化劑／等溫溫度
係數（MTC／ITC），以及落棒／換棒／動態棒價值量度嘅儀器。關鍵在於佢淨係由量到嘅中子通量訊號 n(t)，**反轉**
六羣點動力學方程式去重建堆芯淨反應性：ρ(t) = β_eff + (Λ\*/n)·(dn/dt − Σ λ_i C_i)。佢**完全唔讀引擎內部
已知嘅反應性**，而係由通量歷史自己積分一套緩發中子先驅核 C_i，用解析指數積分器（分段線性源、L-穩定、任何
步長都非負）連低通濾波嘅通量導數處理細小嘅瞬跳項。因為佢獨立解動力學，所以會**跟住但唔會完全等於**真 ρ
——喺快暫態有少少真實嘅動態滯後，同現場反應性計一樣。正因獨立，先可以淨靠通量響應**量度**未知棒／硼價值；
若只係回放引擎 ρ 就毫無意義。佢以假設臨界穩態（C_i = β_i/(Λ\*·λ_i)·n）作初始播種，所以喺任何平衡功率都讀
到 **ρ ≈ 0**。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Inverse-kinetics relation · 反向動力學關係 | ρ = β_eff + (Λ\*/n)(dn/dt − Σλ_i C_i) |
| Kinetics parameters (engine-matched) · 動力學參數（與引擎一致） | 6-group β = {215,1424,1274,2568,748,273} pcm; λ = {0.0124,0.0305,0.111,0.301,1.14,3.01}/s; Λ\* = 2.0×10⁻⁵ s |
| β_eff (cycle-scaled) · β_eff（隨壽期縮放） | 650.2 pcm BOL → ~585 pcm EOL (= $1.00) · 壽期初 650.2 pcm → 壽期末約 585 pcm |
| Precursor update · 先驅核更新 | analytic C_i = C_i·e^(−λΔt) + (β_i/Λ\*λ_i)·[n₁ − (n₁−n₀)(1−e)/(λΔt)] |
| Unit conversions · 單位換算 | pcm = ρ·10⁵; dollars = ρ/β_eff |
| Asymptotic period · 漸近週期 | T = 1/(d ln n/dt), signed (+ rising, − falling) · 帶號（+升 −降） |
| Startup Rate · 起動率 | SUR = 60/(T·ln10) = 26.06/T DPM (decades/min) |
| Reference point · 參考點 | ρ = +50 pcm → T ≈ +200 s → SUR ≈ +0.13 DPM |
| Flux-filter / ρ-display time constants · 通量濾波／顯示時間常數 | τ_flux ≈ 0.8 s, τ_ρ ≈ 0.5 s (smoothing on display only) |
| Positive-rate advisory · 正速率警示 | SUR > +1.0 DPM |
| n floor (division guard) · n 下限（除法保護） | 1×10⁻⁹ of rated (≈ source level) |

### New telemetry · 新增遙測

`MeasuredReactivityPcm`, `MeasuredReactivityDollars`, `MeasuredPeriodSeconds` (signed),
`MeasuredStartupRateDpm` (signed), `ReactimeterPositiveRateAlarm`, plus a **Mark/Clear worth accumulator**
(`MeasuredWorthPcm` / `MeasuredWorthDollars`, `ReactimeterHasMark`). A bilingual **Reactivity computer ·
反應性計算機** panel is added to the NIS instrument row, showing live ρ (pcm and $), signed period and SUR,
and the measured worth, with **Mark / Clear** buttons for rod/boron worth measurements.

新增遙測：`MeasuredReactivityPcm`、`MeasuredReactivityDollars`、`MeasuredPeriodSeconds`（帶號）、
`MeasuredStartupRateDpm`（帶號）、`ReactimeterPositiveRateAlarm`，連 **Mark/Clear 價值累加器**
（`MeasuredWorthPcm`／`MeasuredWorthDollars`、`ReactimeterHasMark`）。NIS 儀表列新增雙語**反應性計算機**
面板，即時顯示 ρ（pcm 同元）、帶號週期同起動率、量度價值，連**標記／清除**掣供棒／硼價值量度。

### How to use · 點用

To **measure** a rod or boron worth: click **Mark** to capture the reference ρ, make the maneuver (withdraw
a bank, dilute boron), and read the integrated **Worth** field — the instrument arrives at the answer from
the flux response alone, with no knowledge of the rod position or boron concentration that caused it.

要**量度**棒或硼價值：撳 **Mark** 記低參考 ρ，做動作（提棒、稀釋硼），再睇積分嘅 **Worth** 欄——儀器淨靠
通量響應得出答案，完全唔知道造成變化嘅棒位或硼濃度。

---

## 2026-06-25 — Uncontrolled RCCA bank withdrawal accident (FSAR 15.4.1 HZP / 15.4.2 at-power) · 失控提棒事故（FSAR 15.4.1 熱零功率／15.4.2 滿載）

**Commit:** [`4374795`](https://github.com/codingmachineedge/WinForge/commit/4374795) on `feature/reactor-hyper`.

### What it models · 模擬內容

The classic **control-rod reactivity-insertion** design-basis accident, completing the reactivity-fault
family alongside the existing **rod ejection (15.4.8)** and **uncontrolled boron dilution (15.4.6)**. A
rod-control-system or CRDM malfunction drives a regulating bank **continuously outward** at the
drive-mechanism maximum, inserting positive reactivity until the reactor protection system trips the plant.

This is implemented **purely emergently**, true to the engine's rule that *a scenario only changes a
boundary condition — physics does the rest*. Triggering the scenario does exactly two things: it forces
**manual rod control** and then, each tick, advances the **group-demand counter** outward at the commanded
drive speed (the existing 8–72 spm rod-control program, here pinned at the 72 spm maximum). Everything
downstream is unscripted:

- **Reactivity** appears only through the existing rod term `ρ_rod = −TotalRodWorth·ΣworthFrac(bank)` and
  its S-curve differential worth — the scenario injects **no reactivity of its own**.
- **Doppler** (prompt fuel-temperature feedback) turns the excursion over, exactly as in the point kinetics.
- **The trip is not coded.** Which protection function scrams depends solely on the operator's initial
  power: from **HFP/at-power** the 2-of-4 **Power-Range High-Flux** (fast rates), **OverTemperature ΔT** or
  **OverPower ΔT** (intermediate/slow rates) act; from **HZP/subcritical** the **Intermediate-Range
  High-Flux + short-period** and **Source-Range High-Flux** trips act. They emerge from the same
  `UpdateProtection` RPS used by every other event.

While active, the scenario is the **sole writer** of the rod-demand counter (auto rod control is forced off),
mirroring how the boron-dilution event is the sole writer of `BoronPpm`. Once a trip seats the rods the
counter stops advancing and is **not** reset, so post-trip rod telemetry stays honest. A dedicated
**RCCA WITHDRAWAL (15.4.1/2)** annunciator lights while the bank is being driven out.

此為經典**控制棒反應性插入**設計基準事故，與現有**彈棒（15.4.8）**及**失控硼稀釋（15.4.6）**共同構成反應性
故障家族。棒控系統或控制棒驅動機構失效，令調節棒組以驅動機構上限**持續向外提升**，插入正反應性直至反應堆
保護系統跳機。本次以**完全湧現**方式實作，貫徹引擎「情景只改邊界條件，物理自行演化」嘅原則：觸發只做兩件
事——強制**手動棒控**，再每個時步以指令速度（現有 8–72 步/分鐘棒控程式，此處鎖定 72 步/分鐘上限）將**群組
需求計數器**向外推。其餘全部非腳本化：反應性只經現有棒項 `ρ_rod = −TotalRodWorth·ΣworthFrac` 及其 S 曲線
微分價值產生（情景本身**不注入任何反應性**）；**都卜勒**反饋扭轉功率脈衝；**跳機並非編碼**——視乎操作員初始
功率，由滿載嘅高通量／OTΔT／OPΔT，或熱零功率嘅中量程高通量＋短週期、源量程高通量等保護自行動作，全部源自
同一套 `UpdateProtection` 反應堆保護系統。活躍期間情景為棒需求計數器**唯一寫入者**（強制關閉自動棒控），
與硼稀釋事件為 `BoronPpm` 唯一寫入者一致；跳機座棒後計數器停止推進且**不**重置，跳機後遙測保持真實。專用
**失控提棒（15.4.1/2）**警報於提棒期間亮起。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Commanded withdrawal speed · 指令提棒速度 | 72 steps/min (drive-mechanism max; 45 in/min) · 72 步/分鐘（驅動機構上限） |
| Rod-control speed program · 棒控速度程式 | 8–72 spm variable (existing) · 8–72 步/分鐘可變（沿用） |
| Bank span / overlap · 棒組行程／重疊 | 228 steps/bank, 128-step overlap, 0–528 demand counter · 每組 228 步、重疊 128 步、需求計數 0–528 |
| Engine peak insertion rate · 引擎峰值插入率 | ≈ 15–25 pcm/s at mid-stroke (computed live) · 行程中段約 15–25 pcm/s（即時計算） |
| FSAR licensing envelope · FSAR 許可包絡 | ≤ 75 pcm/s (worst-case two-bank) · ≤ 75 pcm/s（最壞雙棒組） |
| Terminating trip (at-power) · 終止跳機（滿載） | Power-Range Hi-Flux ~109% / OTΔT / OPΔT |
| Terminating trip (HZP) · 終止跳機（熱零功率） | IR Hi-Flux + short-period / SR Hi-Flux |
| Min-DNBR acceptance limit · 最小 DNBR 接受限值 | ≥ 1.30 (W-3 95/95) |
| Peak-RCS-pressure limit · 一次側峰值壓力限值 | ≤ 2750 psia (110% of design) · ≤ 2750 psia（設計值 110%） |
| ANS condition · ANS 事件類別 | Condition II (moderate frequency) · 第二類（中等頻率） |

### New telemetry · 新增遙測

- **`RodInsertionRatePcmPerSec`** — live reactivity insertion rate (pcm/s), differenced from the *clean*
  rod-bank worth (control-bank only; dropped/ejected worth excluded) so it reflects only the bank motion.
  The FSAR 15.4.1/2 figure of merit. · 反應性插入率，由純控制棒組價值差分得出（剔除落棒／彈棒），FSAR 判據。
- **`RccaWithdrawSpm`** — commanded outward drive speed (steps/min), 0 when inactive. · 指令提棒速度。
- **`RccaWithdrawalActive`** — true while a bank is being driven out under the scenario. · 事故進行中旗標。

### Screenshots · 截圖

Skipped this run — computer-use screenshot access cannot be granted in the unattended scheduled-run
environment (and the build targets a `net11.0` TFM whose runtime is not present here), so the reactor panel
could not be captured. The change is verified by a clean `dotnet build` (0 errors). · 本次略過：無人值守排程
環境無法授予 computer-use 截圖權限（且建置目標 `net11.0` TFM 對應執行階段未安裝），無法截取面板。改動以乾淨
建置（0 錯誤）驗證。

---

## 2026-06-25 — Concentration-dependent differential boron worth (DBW curve) · 隨硼濃度變化嘅硼微分價值（DBW）曲線

**Commit:** [`77ee0ee`](https://github.com/codingmachineedge/WinForge/commit/77ee0ee) on `feature/reactor-hyper`.

### What it models · 模擬內容

In a chemical-shim PWR the **differential boron worth** (reactivity per ppm of soluble boron) is **not a
constant**. Because B-10 is a strong 1/v thermal absorber, at high concentration the boron atoms
**mutually self-shield** and depress the thermal flux, so each extra ppm captures fewer neutrons and is
worth *less*; as boron is diluted out the self-shielding relaxes and **each remaining ppm is worth more**.
The magnitude therefore **increases as concentration falls** — and the integrated (total) boron reactivity
vs. concentration is a **concave** curve, not a straight line. Operationally this is why end-of-cycle
dilution inserts more reactivity per ppm than beginning-of-cycle dilution.

Previously the engine used a single flat coefficient (`BoronWorth = −9.5e-6` Δk per ppm) for every ppm at
every concentration. This run replaces that with a **falling-magnitude line** `DBW(C) = −(b0 − b1·C)` and
its closed-form integral `ρ_B(C) = −(b0·C − ½·b1·C²)` for the total boron reactivity. The host engine runs
a deliberately **compressed boron scale**, so the physical curve is carried for its *shape* and rescaled by
**one scalar** chosen so the total at the nominal 1200 ppm is **byte-identical** to the old constant model
— the calibrated critical band, `ExcessBaseline` and the burnup-defect endpoints are unchanged; only the
**slope away from nominal** now bends the realistic way. Moderator density-vs-temperature feedback stays in
the **MTC** term (DBW is concentration-only) to avoid double-counting the same density physics. A new
**`DifferentialBoronWorthPcmPerPpm`** readout appears on the Boron gauge.

化學補償（chemical shim）壓水堆嘅**硼微分價值**（每 ppm 可溶硼嘅反應性）**並非常數**。B-10 係強 1/v 熱中子
吸收體，濃度高時硼原子**互相自屏蔽**並壓低熱中子通量，每多一 ppm 反而效用較細；硼被稀釋走後自屏蔽放鬆，
**剩低每 ppm 價值更大**。所以價值**隨濃度下降而變大**，而硼總反應性對濃度係**凹形**曲線而非直線——亦解釋
咗點解循環末期稀釋每 ppm 插入嘅反應性多過循環初期。先前引擎對所有濃度用單一固定係數（`BoronWorth =
−9.5e-6`）。今次改為遞減直線 `DBW(C)=−(b0−b1·C)`，總量用閉式積分 `ρ_B(C)=−(b0·C−½·b1·C²)`。引擎用刻意
壓縮嘅硼標度，所以只取物理曲線嘅**形狀**，再用**單一比例**縮放，令標稱 1200 ppm 處總量同舊常數模型**完全
一致**——臨界帶、`ExcessBaseline` 同燃耗虧損端點不變，只有偏離標稱時斜率先按真實物理彎曲。密度對溫度反饋
保留喺 **MTC**（DBW 只隨濃度），避免重複計算。硼錶新增 **`DifferentialBoronWorthPcmPerPpm`** 讀數。

### Key quantitative facts · 主要量化數據

- **Shape · 形狀:** `DBW(C) = −(b0 − b1·C)`, physical anchors `b0 = 1.05e-4` Δk/ppm (−10.5 pcm/ppm at 0 ppm)
  and `b1 = 1.75e-8` Δk/ppm² → **−7.0 pcm/ppm at 2000 ppm** (a ~⅔ roll-off). Integral
  `ρ_B(C) = −(b0·C − ½·b1·C²)`.
- **Direction · 方向:** |worth/ppm| **rises** as boron falls (B-10 self-shielding + slight spectral
  hardening relax). EOL dilution is "stronger" per ppm than BOL.
- **Sources · 來源:** DOE-HDBK-1019/2-93 (chemical shim); Lamarsh & Baratta, *Intro to Nuclear Engineering*;
  Duderstadt & Hamilton, *Nuclear Reactor Analysis*. Physical total worth at ~1200–1500 ppm ≈ 11–14 %Δk
  (matches the textbook 10–15 %Δk band).
- **Calibration preserved · 校準保留:** engine-scale `boronRho(1200) = −0.0114` Δk and `ExcessBaseline =
  0.0914` are **identical** to the pre-change values; engine-scale DBW now runs **−1.06 → −0.70 pcm/ppm**
  across 0 → 2000 ppm (vs. the old flat −0.95), with the EOL burnup-defect endpoint at −1129 pcm (was −1130).
- **Temperature · 溫度:** moderator-density feedback left entirely to **MTC** — DBW carries concentration
  dependence only (no double counting).

---

## 2026-06-25 — Critical Safety Function Status Trees (Westinghouse ERG / SPDS, F-0.1–F-0.6) · 關鍵安全功能狀態樹（西屋 ERG／SPDS，F-0.1–F-0.6）

**Commit:** [`07c68e2`](https://github.com/codingmachineedge/WinForge/commit/07c68e2) on `feature/reactor-hyper`.

### What it models · 模擬內容

After a reactor trip / safety injection, a real Westinghouse control room continuously monitors **six
Critical Safety Functions** through the **ERG status trees** (the heart of the Safety Parameter Display
System, NUREG-0696 / Reg Guide 1.97). Each function is colour-graded **GREEN → YELLOW → ORANGE → RED**
(plus **grey = invalid / insufficient data**), and the highest-priority non-green tree directs the crew
to its **Function Restoration Guideline** (FR-S/C/H/P/Z/I) while they stay in the optimal-recovery EOP.

Previously the reactor page had only a **crude six-cell stub** computed in the UI code-behind — each cell
was a one-line `Func<int>` looking at a *single* signal (Heat Sink read only SG level; Integrity only
overpressure; Containment only meltdown/damage), and it **never emitted YELLOW** at all. This run replaces
that stub with a **proper engine-side evaluator** (`UpdateCriticalSafetyFunctions` in
`ReactorSimService.cs`) that runs every tick — in both the normal and the meltdown update paths — and maps
the already-computed plant signals through the six status trees in the fixed Westinghouse priority order
**S > C > H > P > Z > I**. It reuses existing physics (the `IccRed`/`IccOrange` core-exit-thermocouple
bools, RVLIS, subcooling margin, SG level/feed, RCS pressure & cooldown rate, containment pressure/rad,
pressurizer level) — **no physics is recomputed**, and the meltdown / real-shutdown ARM path is untouched.
The UI tiles now bind by index to the engine objects with preallocated per-status brushes and a tooltip
showing the entry **FR guideline + one-line cause** (e.g. `FR-C.1 · CET 1240°C ≥ 649°C`).

跳堆／安全注入之後，真實西屋控制室會透過 **ERG 狀態樹**（安全參數顯示系統 SPDS 的核心，NUREG-0696／RG 1.97）
持續監測**六項關鍵安全功能**。每項以**綠→黃→橙→紅**分級（另加**灰＝資料無效／不足**），而優先級最高的非綠
狀態樹會指引操作員進入對應的**功能恢復導則**（FR-S/C/H/P/Z/I）。先前反應堆頁只有介面側的**粗略六格**：每格
單看一個訊號、且**從不出黃色**。今次改為**引擎側評估器**，每個 tick（正常與熔毀路徑都跑）按西屋優先次序
**S > C > H > P > Z > I** 將現有廠房訊號映射到六棵狀態樹，重用既有物理（堆芯出口熱電偶 `IccRed`/`IccOrange`、
RVLIS、過冷裕度、蒸發器水位／給水、一迴路壓力與降溫率、安全殼壓力／輻射、穩壓器水位），**不重算物理**，
熔毀／真實關機 ARM 路徑不變。介面格仔改為按索引綁定引擎物件，提示顯示進入的 **FR 導則＋一行成因**。

### The six trees & branch setpoints · 六棵樹與分支設定點

| Fn · 功能 | RED | ORANGE | YELLOW | FRG |
|---|---|---|---|---|
| **S** Subcriticality · 次臨界度 | tripped yet >5% RTP or +SUR (ATWS) | un-tripped >105% RTP | +startup rate >0.5 DPM | FR-S.1 / FR-S.2 |
| **C** Core Cooling · 堆芯冷卻 | CET ≥ **649 °C** (1200 °F) | CET ≥ **371 °C** (700 °F) or subcooling lost | SMM < 11 °C or RVLIS < 62 % | FR-C.1 / .2 / .3 |
| **H** Heat Sink · 熱阱 | SG NR <17 % **and** no feed (main+aux) | SG NR < **17 %** lo-lo | SG NR <30 % or marginal feed | FR-H.1 / FR-H.5 |
| **P** RCS Integrity · 一迴路完整性 | RCS > **17.2 MPa** (overpressure/PTS) | within 1 MPa of limit | cooldown < **−55 °C/hr** (~100 °F/hr) | FR-P.1 / FR-P.2 |
| **Z** Containment · 安全殼 | meltdown / rad alarm / press ≥ **186 kPa** (~27 psig Hi-3) | press ≥ **28 kPa** (~4 psig Hi-1) or damage | rad >0.5 or sump rising | FR-Z.1 / FR-Z.3 |
| **I** RCS Inventory · 一迴路存量 | PZR off-scale-low + RVLIS <62 % | PZR < **17 %** | PZR <30 % or >**92 %** overfill | FR-I.2 / FR-I.1 / FR-I.3 |

The panel annunciator takes the **worst** colour across the six (`WorstCsfStatus`); the operator works the
**first non-green** tree in S,C,H,P,Z,I order (`HighestPriorityCsf`) — even if a lower-priority tree is
redder. The 649 °C / 371 °C core-cooling setpoints are the plant's existing `IccRedTempC` / `IccOrangeTempC`
constants (FR-C.1 / FR-C.2), reused verbatim rather than re-derived.

### New public API · 新增公開介面

- `enum CsfStatus { Invalid, Green, Yellow, Orange, Red }` (ordinal-ordered for the worst-of MAX).
- `readonly struct CsfState` — mnemonic char, bilingual name, status, FR-guideline id, bilingual cause
  (re-Picks language on read; zero per-tick heap traffic).
- `IReadOnlyList<CsfState> CriticalSafetyFunctions`, `CsfStatus WorstCsfStatus`, `CsfState? HighestPriorityCsf`.

### Screenshots · 截圖

Skipped this run — computer-use screen capture cannot be granted in the unattended scheduled-run
environment, so the app was not launched (no stray process left). The change is verified by a clean
`dotnet build -c Debug -p:Platform=x64` (**0 errors**). · 本次略過：排程無人值守環境無法取得電腦使用截圖
權限，故未啟動程式（亦無遺留行程）。改動已以乾淨建置（**0 錯誤**）驗證。

---

## 2026-06-25 — Control-board annunciator sequence (ISA-18.1 "R-F"): first-out latch + ringback + acknowledge/silence/reset · 控制盤警報序列（ISA-18.1「R-F」）：首發鎖存連回響同確認／靜音／重置

**Commit:** [`d4a23a5`](https://github.com/codingmachineedge/WinForge/commit/d4a23a5) on `feature/reactor-hyper`.

### What it models · 模擬內容

The reactor's ~90 alarms were previously plain on/off lamps. A real main-control-board annunciator
window does **not** behave like a boolean — it follows an **ISA-18.1-1979 (R2004)** *sequence*. This run
replaces the boolean tiles with a deterministic **sequence "R-F" (Ringback + First-out)** state machine
layered directly over the existing alarm flags. It is a pure HMI / state-machine layer: it touches **no
physics, no reactivity, no energy balance**, and the meltdown / real-shutdown ARM path is untouched.

Each window now lives in one of four logic states (plus a first-out variant):

- **New alarm** → window **FAST-FLASHES at 120 fpm (2 Hz)** and the **horn** sounds.
- **ACKNOWLEDGE** → flash converts to **STEADY ON** and the horn is silenced (the window stays lit while
  the condition persists). The first-out latch is *held* through acknowledge.
- **Process clears (before RESET)** → the window does **not** go dark; it enters **RINGBACK — SLOW-FLASH
  at 60 fpm (1 Hz)** with a soft, tonally-distinct **988 Hz chime** until the operator presses **RESET**.
- **RESET** → ringback windows extinguish; a still-live alarm **cannot** be reset away (it demotes to
  steady acknowledged), so an operator can never clear a real condition.
- **First-out**: the **first** window to come in after a quiescent panel latches as a distinct **magenta
  fast-flash** marker, so on a reactor-trip cascade (dozens of windows light within ~1–2 s) the **trip
  initiator** stays identifiable — exactly what a Westinghouse first-out panel is for.
- **SILENCE** kills the horn **without** acknowledging (lamps keep fast-flashing); **LAMP TEST** asserts
  every tile for ~700 ms without mutating any latched state. SILENCE auto-cancels on the next new alarm
  (reflash), so a fresh excursion always re-sounds the horn.

控制盤上嘅警報視窗唔係單純開／關，而係跟從 **ISA-18.1-1979（R2004）** 嘅序列。今次將約 90 個布林警報磚換成
確定性嘅 **「R-F」（回響＋首發）** 狀態機，直接疊喺現有警報旗標之上：純人機界面層，**唔掂任何物理、反應性或
能量平衡**，熔毀／真實停堆武裝路徑不受影響。新警報以 **120 fpm（2 Hz）快閃**並響喇叭；按**確認**轉為**長亮**並靜
喇叭（首發鎖存保留）；工況回復正常但未重置時，視窗唔會熄，而係進入 **回響——60 fpm（1 Hz）慢閃**並響柔和、音色
有別嘅 **988 Hz 鐘聲**，直至按**重置**；仍然有效嘅警報唔可以被重置清除（會降為長亮已確認）。**首發**：警報盤靜止
後首個入嘅警報鎖存為**洋紅快閃**標記，喺停堆連鎖警報（1–2 秒內幾十個視窗同時亮）中辨識**觸發源**。**靜音**只熄
喇叭而唔確認；**燈測**點亮全部磚而唔改狀態；靜音會喺下一個新警報自動取消（重閃）。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Standard · 標準 | **ISA-18.1-1979 (R2004)** "Annunciator Sequences and Specifications", sequence **R-F** |
| Successor · 後繼標準 | ANSI/ISA-18.2 (2009/2016) — defines alarm *states/lifecycle* rather than flash rates |
| Fast (new-alarm) flash · 新警報快閃 | **120 fpm = 2.0 Hz** (period 0.5 s, 50 % duty); typical range 60–150 fpm |
| Slow (ringback) flash · 回響慢閃 | **60 fpm = 1.0 Hz** (period 1.0 s, 50 % duty); typical range 30–60 fpm |
| Spec relationship · 規範關係 | slow ≈ ½ fast (the *distinction* is mandated; absolute fpm is vendor/plant-specific) |
| Logic states · 邏輯狀態 | Normal / FastFlash / FastFlash-FirstOut / Acked / Ringback |
| First-out per burst · 每次爆發首發數 | exactly **1** (later string members inhibited; latch held through ACK, cleared on RESET or quiescent) |
| Alarm horn · 警報喇叭 | 660 Hz square (existing buzzer voice) |
| Ringback chime · 回響鐘聲 | **988 Hz** two-tone bell, ~0.45 s pulse per 1 s gate, softer than the horn |
| Shared flash phase · 共用閃爍相位 | one `dt`-accumulated accumulator, LCM period 1.0 s — identical at 30/60/144 fps, zero per-frame alloc |

### New operator-visible elements · 新增可見元素

- **Four ACK / SILENCE / RESET / LAMP-TEST pushbuttons** are now wired to true ISA-18.1 semantics (they
  were previously crude global booleans).
- **Magenta first-out tile** with a thick white border identifies the trip initiator in a cascade.
- **Teal slow-flashing ringback tiles** mark cleared-but-not-reset windows awaiting RESET.
- **Bilingual panel legend** above the annunciator grid explaining the flash/colour code.
- A new **`Ringback()` synthesized voice** in `ReactorAudioEngine` (no bundled audio assets).

### How to see it · 點睇

Open the **Reactor** module → trip the plant (or drive any parameter past a setpoint). Watch the windows
fast-flash with the horn; the first one in turns magenta (first-out). Press **ACK** → they go steady and
the horn stops. Let the condition clear → the window slow-flashes teal with the ringback chime. Press
**RESET** → it clears. **SILENCE** quiets the horn while leaving the lamps flashing; **LAMP TEST** lights
every tile.

### Research · 研究

ultracode multi-agent pass: three parallel research agents (ISA-18.1/18.2 standards & flash rates; NPP
control-room first-out/ringback practice; a deterministic managed-C# state-machine design) → one
synthesis producing the implementation-ready spec (state enum, transition table, 120/60 fpm rates,
first-out latch rules, audio derivation).

### Screenshots · 截圖

_Skipped this run._ Capturing the sequence requires interactively navigating to the reactor module and
driving an alarm cascade, which needs control-grants unavailable in the unattended scheduled environment;
a blind capture would show only the dashboard. To be added on an interactive run.

---

## 2026-06-25 — Fuel pellet radial conduction + pellet-clad gap conductance: centerline/surface temps, burnup & FGR-dependent h_gap, kW/ft and fuel-centerline-melt margin · 燃料芯塊徑向導熱連芯塊–包殼間隙熱導：中心／表面溫度、隨燃耗及裂變氣體釋放變化嘅 h_gap、線功率密度同中心熔化裕度

**Commit:** [`11cab45`](https://github.com/codingmachineedge/WinForge/commit/11cab45) on `feature/reactor-hyper`.

### What it models · 模擬內容

Until now the core carried a single lumped `FuelTemp` — a calibrated abstract node anchored to the Doppler
datum, with no notion of *where* inside the fuel pin the heat actually is. A real UO₂ fuel pin has a steep
**radial** temperature profile: the centerline runs ~1000–1400 °C at full power while the pellet surface sits
near ~430 °C, and most of that drop is split across four series thermal resistances — the coolant film, the
Zircaloy cladding, the **pellet-cladding gas gap**, and conduction through the ceramic pellet itself. This run
reconstructs that whole chain from the **linear heat rate** q′, anchored on the *real* coolant temperature
`Tavg` (so it is independent of the abstract lump). The standout physics is the **gap conductance** h_gap: at
beginning-of-life the gap is an open helium-filled annulus (~0.6 W/cm²·K), but across the cycle fuel swelling
(~0.7 %ΔV/V per 10 GWd/tU) and clad creepdown close it to metal-to-metal contact (~2–4 W/cm²·K) by ~20 GWd/tU,
while **fission-gas release** (Xe/Kr, ~10× less conductive than He) dilutes the fill gas and partly offsets the
gain. The operator figure of merit is the **fuel-centerline-melt margin**: the hot-rod (F_Q≈2.56) centerline
versus the burnup-derated UO₂ melting point (2840 − 3.2·GWd/tU °C), plus head-room to the ~21 kW/ft FCM linear-
heat-rate design limit. All members are **read-only diagnostics** — the calibrated `FuelTemp` integration and
the Doppler reactivity term are left *bit-for-bit* unchanged, so the steady-state balance and the
meltdown-ARM path are provably unaffected.

至今堆芯只得一個集總 `FuelTemp`——錨定多普勒基準嘅抽象節點，並無「燃料棒內邊度先係熱」嘅概念。真實 UO₂
燃料棒有陡峭嘅**徑向**溫度分佈：滿功率時中心約 1000–1400 °C，而芯塊表面約 430 °C，當中大部分溫降分攤喺四
個串聯熱阻——冷卻劑薄膜、鋯合金包殼、**芯塊–包殼氣隙**，同陶瓷芯塊本體導熱。本次由**線功率密度** q′ 重建
整條鏈，並錨定**真實**冷卻劑溫度 `Tavg`（故與抽象集總無關）。重點物理係**間隙熱導** h_gap：壽期初氣隙為開放
充氦環隙（約 0.6 W/cm²·K），但隨循環推進，燃料腫脹（每 10 GWd/tU 約 0.7 %ΔV/V）同包殼蠕變收口，到約
20 GWd/tU 收成金屬接觸（約 2–4 W/cm²·K），同時**裂變氣體釋放**（Xe/Kr，導熱約為氦嘅 1/10）稀釋充填氣，部分
抵銷增益。操作員判據係**中心熔化裕度**：峰棒（F_Q≈2.56）中心溫對隨燃耗下降嘅 UO₂ 熔點（2840 − 3.2·GWd/tU
°C），連距約 21 kW/ft 中心熔化線功率設計限值嘅裕量。所有成員均為**只讀診斷**——已校準嘅 `FuelTemp` 積分同
多普勒反應性項一個位都冇改，故穩態平衡同熔毀解除路徑可證不受影響。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Core-avg linear heat rate q′ (100 %) · 堆芯平均線功率 | ≈ 5.5 kW/ft (17.9 kW/m) |
| Hot-channel peak q′ (F_Q≈2.56) · 峰通道線功率 | ≈ 14 kW/ft (46 kW/m) |
| Fuel-centerline-melt LHR limit · 中心熔化線功率限值 | ≈ 21 kW/ft |
| Centerline-to-surface ΔT_pellet = q′/(4π·k) · 芯塊中心–表面溫降 | ≈ 475 °C (avg) · ≈ 1220 °C (peak), k_UO₂≈3.0 W/m·K |
| Gap ΔT_gap = q′/(π·D·h_gap) · 間隙溫降 | ~100–300 °C (BOL), falls as gap closes |
| h_gap BOL open He gap · 壽期初開放氦間隙 | ~0.6 W/cm²·K (6 000 W/m²·K) |
| h_gap closed/contact (high BU) · 收口接觸 | ~2–4 W/cm²·K (20–40 k W/m²·K) |
| As-fab radial cold gap · 冷態徑向間隙 | ~88 µm (diametral ~176 µm) |
| Effective gap closure burnup · 有效收口燃耗 | ~20 GWd/tU |
| Fill-gas k: He vs Xe/Kr · 充填氣導熱 | 0.155 vs 0.015 W/m·K (~10×) |
| Fission-gas release ramp · 裂變氣體釋放 | ~1 % (BOL) → ~15 % (EOL) |
| UO₂ melt point + burnup derate · UO₂ 熔點連燃耗derate | 2840 °C − 3.2 °C/(GWd/tU) |
| Fuel centerline @ 100 % (avg rod) · 滿功率中心溫 | ~1000–1400 °C |
| Pellet surface @ 100 % · 滿功率芯塊表面 | ~400–470 °C |
| Doppler radial weight (Rowlands) · 多普勒徑向權重 | T_eff = 0.7·surface + 0.3·centre (diagnostic) |

### New gauges · 新增儀錶

- **Fuel centerline · 燃料中心溫** — average-rod centerline, with pellet surface and hot-rod centerline.
- **Centerline-melt margin · 中心熔化裕度** — hot-rod centerline vs the burnup-derated UO₂ melt point.
- **Linear heat rate · 線功率密度** — core-average and hot-channel peak q′ (kW/ft) + margin to 21 kW/ft.
- **Gap conductance · 間隙熱導** — h_gap (W/cm²·K), gap ΔT, and fission-gas-release fraction.

### Screenshots · 截圖

Skipped this run — computer-use screenshot access cannot be granted in the unattended scheduled-run
environment, so the reactor panel could not be captured. The change is verified by a clean `dotnet build`
(0 errors, x64 Debug). · 本次略過：排程無人值守環境無法授予電腦操作截圖權限，未能擷取反應堆面板。改動已以
乾淨建置（0 錯誤，x64 Debug）驗證。

---

## 2026-06-25 — Pressurized Thermal Shock (PTS) monitor: 10 CFR 50.61 vessel embrittlement (RT_PTS) + transient K_I/K_IC fracture-mechanics figure of merit · 承壓熱衝擊（PTS）監測：10 CFR 50.61 容器輻照脆化（RT_PTS）連暫態 K_I/K_IC 斷裂力學判據

**Commit:** [`5b56d02`](https://github.com/codingmachineedge/WinForge/commit/5b56d02) on `feature/reactor-hyper`.

### What it models · 模擬內容

The existing Appendix-G block bounds **slow, quasi-static** pressurization against a fixed mid-life
reference temperature. PTS is the complementary **fast-transient** threat that actually bounds reactor-vessel
life: an overcooling event (MSLB, SGTR, a stuck-open-then-reseat PORV, or a small LOCA) plunges the downcomer
fluid temperature while the thick, irradiated beltline metal lags warm. The resulting steep through-wall
gradient produces a **tensile** inner-surface thermal stress that **adds to** the pressure (membrane) stress —
and if high-head safety injection then **repressurizes** the cold, embrittled vessel, the combined
stress-intensity `K_I` at a postulated flaw can reach the now-low fracture toughness `K_IC` → brittle crack
initiation. This is the 10 CFR 50.61 concern. The monitor is **display-only** (like RVLIS/CET/PRT): it never
trips the plant and never writes any state.

原本的附錄 G 模組只針對**緩慢、準靜態**的升壓，對照固定中壽參考溫度。PTS 是互補的**快暫態**威脅，真正界定反應堆
容器壽命：過冷事故（主蒸汽管爆裂、蒸發器爆管、卡開後重新坐封的 PORV、或小破口失水）令降水道流體溫度驟降，而厚重、
已輻照的堆芯帶金屬溫度滯後偏高。由此產生的陡峭穿壁溫度梯度造成**受拉**的內壁熱應力，**疊加**於壓力（薄膜）應力之上；
若高壓安注隨後將又冷又脆的容器**重新升壓**，假設裂紋處的合成應力強度因子 `K_I` 可達到此時偏低的斷裂韌性 `K_IC` →
脆性裂紋起裂。此即 10 CFR 50.61 的關注點。本監測為**唯讀**（與 RVLIS／CET／PRT 一樣）：永不跳堆、永不寫入任何廠況。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

- **Embrittlement (RG 1.99 Rev.2)**: `RT_PTS = RT_NDT(initial) + ΔRT_NDT + Margin`, with
  `ΔRT_NDT = CF · f^(0.28 − 0.10·log₁₀ f)`, `f` = fast fluence in 10¹⁹ n/cm² (E>1 MeV), and
  `Margin = 2·√(σ_I² + σ_Δ²)`, σ_Δ (welds) capped at 28 °F (and at ½·ΔRT_NDT) before squaring.
- **Vessel-age knob `VesselEfpy`** (0–60 EFPY, default 32) scales fluence linearly from an EOL value of
  **3.0 × 10¹⁹ n/cm² at 60 EFPY**. With CF = 180 °F this gives **RT_PTS ≈ 260 °F at 32 EFPY** — just under
  the screen — rising **over 270 °F near end-of-life**.
- **10 CFR 50.61(b)(2) screening criteria**: **270 °F** (plates / forgings / axial welds), **300 °F**
  (circumferential welds).
- **Fracture toughness** reuses the exact ASME XI App-G `K_IC = 33.2 + 20.734·exp(0.02·(T − RT_PTS))`
  [ksi·√in, °F], re-anchored to RT_PTS and shelf-capped at **200 ksi·√in**.
- **Flaw & geometry**: ASME App-G **¼-thickness** inner-surface reference flaw `a = 0.25·t = 2.125 in`;
  vessel `R = 86 in`, `t = 8.5 in` (R/t ≈ 10.1); membrane influence `F_p = 1.10`, thermal `F_th = 0.70`.
- **Stresses**: pressure hoop `σ = p·R/t`; thermal `σ_th = E·α/(1−ν)·ΔT` with
  `E·α/(1−ν) = 0.3064 ksi/°F` (E = 28 600 ksi, α = 7.5×10⁻⁶/°F, ν = 0.3). Wall-temp lag `τ = 30 s`.
- **Advisories**: *PTS susceptible* when downcomer < 400 °F **and** (cooldown faster than −28 °C/hr **or**
  repressurizing faster than 0.05 MPa/s); *PTS flaw initiation* when `K_I ≥ K_IC` (margin ≤ 1).

### Sanity checks · 合理性檢查

- **Hot full power** (Tcold ≈ 556 °F, 15.5 MPa): wall tracks fluid (K_Ith ≈ 0), K_Ip ≈ 65 ksi·√in,
  K_IC capped at 200 → margin ≈ 3.1, no alarms.
- **Cold depressurized**: K_I ≈ 0.8 ksi·√in → margin ≈ 40, comfortable.
- **MSLB / stuck-PORV + HPSI repressurization** (the dominant PTS sequence): downcomer to ~120 °F at
  ~−83 °C/hr arms the susceptible advisory; wall lags warm → K_Ith ≈ 100 ksi·√in, repressurization to
  ~17 MPa → K_Ip ≈ 71 ksi·√in, K_IC at the cold wall ≈ 79 ksi·√in → **margin ≈ 0.46 → flaw-initiation
  advisory asserts**, the intended worst-case behaviour at the repressurization overlap.
- **Heatup** is one-sided (ΔT < 0 ⇒ compressive thermal SIF discarded) so no false initiation.

### New operator-visible elements · 新增可見元素

- **3 gauges** on the reactor panel: *RT_PTS embrittlement* (vs the 270 °F screen, with the live EFPY),
  *PTS K_I / K_IC* utilisation (warns at 1.0, shows the margin), *Vessel wall temp* (with a "PTS WATCH" cue).
- **2 annunciators**: `PTS SUSCEPTIBLE COND. · 承壓熱衝擊敏感工況` and `PTS FLAW INITIATION · 承壓熱衝擊裂紋起裂`.

### How to see it · 點睇

Inject a Main Steam Line Break (or a stuck-open PORV) from a hot, pressurized state and watch the *Vessel
wall temp* gauge lag the falling cold-leg temperature: the *PTS K_I/K_IC* needle climbs as the thermal
gradient opens, and if SI repressurizes the cold vessel the margin dives below 1 and the **PTS FLAW
INITIATION** annunciator lights. Raising `VesselEfpy` toward 60 (more embrittled) makes the same transient
initiate sooner.

> _Screenshots skipped this run — computer-use capture cannot be granted in an unattended scheduled run; no app process was launched._

### Research · 研究

Multi-agent **ultracode** pass (4 agents): RG 1.99 Rev.2 embrittlement + 10 CFR 50.61 screening; ASME XI
App-G fracture mechanics + representative PTS overcooling transients; managed-C# integration; synthesis with
adversarial reconciliation of flaw depth (¼-T vs sub-clad), pressure influence factor, and wall-lag τ.

---

## 2026-06-25 — Fuel-cycle core depletion: burnup-coupled MTC, β_eff and critical-boron letdown · 燃料循環堆芯燃耗：燃耗連動慢化劑溫度係數、有效緩發中子分數同臨界硼降硼曲線

**Commit:** [`04400bc`](https://github.com/codingmachineedge/WinForge/commit/04400bc) on `feature/reactor-hyper`.

### What it models · 模擬內容

Burnup was previously a **cosmetic counter** with no physics behind it — the reactivity coefficients never
changed as the core aged. This run turns it into a real **beginning-of-life → end-of-life (BOL→EOL) depletion
model**: as the fuel burns, the three coefficients that actually drift over a fuel cycle now drift, all
anchored so that **at burnup 0 the behaviour is bit-identical to before** (every term is written `base +
slope·f`, where the cycle fraction `f = burnup / 18 GWd·tU`).

燃耗以往只是一個**裝飾性計數器**，背後並無物理——反應性係數從不隨堆芯老化而變。今次將其變成真正的
**壽期初到壽期末（BOL→EOL）燃耗模型**：燃料消耗時，循環中真正會漂移的三個係數現在都會漂移，並全部錨定，
使**燃耗為零時行為與先前完全一致**（各項皆為 `base + slope·f`，循環進度 `f = 燃耗 / 18 GWd·tU`）。

- **Moderator Temperature Coefficient (MTC) trends more negative.** At BOL the high soluble-boron
  concentration supplies a positive density component that holds MTC near `−20 pcm/°C`; as boron is diluted
  out over the cycle that positive term vanishes and the intrinsically negative moderator-density term is
  unmasked, so the effective MTC reaches `−40 pcm/°C` at EOL. · **慢化劑溫度係數趨向更負。** 壽期初高硼濃度
  提供正密度分量，令 MTC 維持約 `−20 pcm/°C`；循環中硼被稀釋走，正分量消失，本身為負的慢化劑密度項浮現，
  有效 MTC 在壽期末達 `−40 pcm/°C`。
- **β_eff (one dollar) shrinks with Pu ingrowth.** As Pu-239/Pu-241 (small delayed fractions) build in, the
  effective delayed-neutron fraction scales by `(1 − 0.10·f)`: one dollar drops from **650 pcm** (BOL) to
  **585 pcm** (EOL), so the *same* pcm insertion is a larger fraction of a dollar and transients/rod-ejection
  sharpen late in life. The scale is applied **consistently at all five `Beta[]`/`BetaTotal` sites** (the
  implicit-Euler denominator, the precursor feedback and update, and both precursor seeds) so no phantom
  reactivity is injected by changing β on a running core. · **有效緩發中子分數（一美元）隨鈽積累而縮小。**
  Pu-239／Pu-241（緩發分數細）積累時，有效緩發中子分數乘以 `(1 − 0.10·f)`：一美元由 **650 pcm**（壽期初）
  降至 **585 pcm**（壽期末），故*同樣*的 pcm 插入佔一美元比例更大，壽期末瞬變／彈棒更敏感。該縮放在**全部五處
  `Beta[]`/`BetaTotal`**（隱式歐拉分母、前驅體反饋與更新、兩個前驅體初始化）一致套用，避免運行中改 β 注入虛假反應性。
- **Critical-boron letdown + a folded-in burnup defect.** The estimated HFP-ARO critical boron lets down from
  **1200 ppm** (BOL) to **10 ppm** (EOL). A fuel-depletion reactivity defect `BoronWorth·(1200 − C(f))` is
  folded into the reactivity balance (`0 → −1130 pcm` over the cycle); the operator cancels it by diluting
  boron down to the **displayed target**, exactly as in a real plant. At BOL `C = 1200 ppm` so the defect is
  zero. · **臨界硼降硼曲線連折入燃耗負反應性。** 估算的熱滿功率全棒抽出臨界硼由 **1200 ppm**（壽期初）降至
  **10 ppm**（壽期末）。燃耗負反應性 `BoronWorth·(1200 − C(f))` 折入反應性平衡（整個循環 `0 → −1130 pcm`）；
  操作員按**顯示目標**稀釋硼即可抵銷，與真實電廠一致。壽期初 `C = 1200 ppm`，負反應性為零。
- **Opt-in cycle-depletion accelerator (default OFF / real time).** Real-time burnup accrual (~34 MWd/tU per
  EFPD at full power) is glacial; a combo offers ×1000/×10000/×50000 fast-forward so a full BOL→EOL cycle is
  watchable in one session, with a visible off switch (back to ×1). · **可選循環燃耗加速器（預設關閉／即時）。**
  實時燃耗累積（滿功率約每滿功率日 34 MWd/tU）極慢；提供 ×1000／×10000／×50000 快進，可在一節觀察完整
  壽期初→壽期末循環，並有明顯關閉開關（回 ×1）。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | BOL (f=0) | EOL (f=1) |
| --- | --- | --- |
| Cycle length · 循環長度 | — | **18 GWd/tU ≈ 528 EFPD** (18-month cycle) |
| Specific power / accrual · 比功率／累積率 | **34.1 MW/tU → 34.1 MWd/tU per EFPD** | (× power fraction) |
| MTC · 慢化劑溫度係數 | **−20 pcm/°C** (`−2.0×10⁻⁴`) | **−40 pcm/°C** (`−4.0×10⁻⁴`) |
| β_eff (one dollar) · 有效緩發中子分數（一美元） | **0.0065 (650 pcm)** | **0.00585 (585 pcm)** — `×(1−0.10·f)` |
| Critical boron (HFP ARO) · 臨界硼（熱滿功率全棒抽出） | **1200 ppm** | **10 ppm** |
| Burnup reactivity defect · 燃耗負反應性 | **0 pcm** | **−1130 pcm** (folded in; cancelled by letdown) |
| Doppler coefficient · 都卜勒係數 | `−2.8×10⁻⁵ /°C` (held fixed; EOL shift is 2nd-order) | unchanged |

Sources · 來源: Lamarsh & Baratta *Intro to Nuclear Engineering*; Duderstadt & Hamilton *Nuclear Reactor
Analysis*; Keepin *Physics of Nuclear Kinetics*; NUREG-0800 SRP; DOE-HDBK-1019. (Researched via ultracode.)

### How to see it · 點睇

Open the reactor module → in the reactivity/poison gauge family find **Core burnup** (GWd/tU · EFPD ·
BOL/MOL/EOL phase) and **Boron letdown** (critical-boron target · live MTC · live dollar value). Under the
control surface, the **Fuel cycle / core depletion** section has the depletion accelerator (default OFF). Set
it to ×10000, run at power, and watch the dollar shrink, the MTC swing negative, and the boron target let
down as the core ages — then dilute boron to the target to ride the cycle. · 開反應堆模組 → 喺反應性／毒物
儀錶群搵 **堆芯燃耗**（GWd/tU · 滿功率日 · 壽期初/中/末）同 **降硼曲線**（臨界硼目標 · 即時 MTC · 即時美元值）。
喺控制面板 **燃料循環／堆芯燃耗** 區有燃耗加速器（預設關閉）。設為 ×10000、滿功率運行，睇住美元縮小、MTC
轉負、硼目標下降，然後跟住目標稀釋硼以走完循環。

> _Screenshots skipped this run — the scheduled (unattended) environment cannot grant computer-use screen
> capture. 本次略過截圖——排程（無人值守）環境無法授予螢幕擷取權限。_

---

## 2026-06-25 — Chemical & Volume Control System (CVCS): charging/letdown inventory balance + Volume Control Tank + RCP seal injection + boric-acid/RMW makeup blender · 化學及容積控制系統（CVCS）：上充／下泄存量平衡＋容積控制缸＋主泵軸封注入＋硼酸／淡水補水混合器

**Commit:** [`2bd0546`](https://github.com/codingmachineedge/WinForge/commit/2bd0546) on `feature/reactor-hyper`.

### What it models · 模擬內容

The sim already controlled pressurizer level, boron and RCP-seal leakoff — but the **plant system that
physically does that work**, the Chemical & Volume Control System, was never modelled. This run adds the
CVCS as an **additive, single-writer-safe inventory/flow layer**: it reveals the charging and letdown flows
behind the existing level loop, integrates the one genuinely new state — the **Volume Control Tank (VCT)**
level — and drives the **boric-acid / reactor-makeup-water (RMW) blender** that holds VCT level and adjusts
soluble boron, all without ever becoming a second author of `PressurizerLevel`, `PrimaryPressure` or `BoronPpm`.

- **Charging flow is the *revealed mechanism* behind the level loop, not a competing author.** Total charging
  = normal-charging line + seal injection + a proportional response to pressurizer-level error
  (`3.5 gpm/%`) + a response to an outsurge (`0.8 gpm per −%/s`), clamped to the physical pump band
  **40–140 gpm**. It is computed *after* the existing level program runs each 50 Hz sub-step, so it reads the
  final level + surge rate and never writes level back.
- **Letdown** is a fixed **75 gpm** orifice flow, forced to **0** the instant the existing CCW non-regen-HX
  letdown-isolation latch (58.3 °C / 137 °F) sets — so a loss-of-CCW correctly starves the VCT.
- **Seal injection** is **32 gpm** to the four RCP packages (4 × 8 gpm): **20 gpm** goes down-shaft into the
  RCS cold leg, **12 gpm** returns to the VCT as controlled #1-seal leakoff. Under a seal LOCA the leakoff
  *return* is capped at the controlled value — the runaway flow goes out the failed seal to containment (it is
  already driving the primary inventory deficit), so the VCT correctly **drains** instead of spuriously filling.
- **VCT (the one new integrated state):** usable volume ≈ **300 ft³ (2244 gal)**, integrated on the net of
  letdown + leakoff-return + makeup − charging-suction − divert. The makeup blender holds level in a **50–60 %**
  band — auto-makeup below 50 %, divert-to-holdup above 60 % (mutually exclusive bands) — with a **low-level
  makeup** annunciator at 18 % and a **very-low VCT→RWST suction swap** at 8 %. H₂ cover-gas pressure relaxes
  to a level-coupled target, clamped to the **15–75 psig** operating band.
- **Makeup blender never touches reactivity.** In **AUTOMATIC** the blend matches the current RCS boron
  (zero net reactivity); **BORATE / DILUTE / ALTERNATE-DILUTE** are operator-intent display selections that
  change the boric-acid/RMW split shown — none of them writes `BoronPpm`, so `UpdateBoron` stays the sole
  boron author.
- **Steady-state mass balance closes to net-zero by construction:** RCS — normal charging (55) + seal-to-RCS
  (20) = letdown (75); VCT — letdown (75) + leakoff (12) = total charging suction (87). Net VCT flow ≈ 0.
- **Deterministic & concurrency-safe:** a pure function of current state + the sub-step `h`, with every flow
  clamped to a physical band and the VCT level clamped 0–100 % before use — no wall-clock, no RNG — so it is
  identical under the concurrent scheduled-reactor runs and cannot integrate off-scale after a paused/resumed
  large step.

本次將化學及容積控制系統（CVCS）加入為**附加且單一寫入者安全嘅存量／流量層**：揭示現有水位迴路背後嘅上充與
下泄流量，積分唯一新增狀態——**容積控制缸（VCT）液位**，並驅動**硼酸／淡水（RMW）補水混合器**維持液位及調整
可溶硼，全程絕不成為 `PressurizerLevel`、`PrimaryPressure` 或 `BoronPpm` 嘅第二寫入者。上充流量＝正常充水
＋軸封注入＋水位誤差比例項（3.5 gpm/%）＋外湧響應（0.8 gpm/(−%/s)），夾於 **40–140 gpm**，於每個 50 Hz
子步嘅水位程序之後計算，只讀不寫水位。下泄為固定 **75 gpm** 孔板，遇現有設備冷卻水下泄隔離閂鎖（58.3 °C）即
歸零。軸封注入 **32 gpm**（20 入一次側、12 回容積控制缸）；軸封失水時回流封頂於受控值，故缸體正確排空。容積
控制缸可用容積約 **300 立方呎**，補水混合器將液位維持喺 **50–60%** 帶內（低補水、高分流），18% 低液位警報、
8% 切換上充吸入至換料水缸；氫氣覆蓋氣壓力夾於 **15–75 psig**。混合器自動模式匹配一次側硼濃度（零淨反應性），
加硼／稀釋／交替稀釋僅為顯示意圖——絕不寫入 `BoronPpm`。穩態質量平衡淨零（75+12−87=0）。整個層為純函數、
確定性、並行安全。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
| --- | --- |
| Total charging (nominal) · 上充總流量（標稱） | **87 gpm** (55 normal + 32 seal) |
| Charging clamp band · 上充夾制帶 | **40–140 gpm** |
| Letdown (one orifice) · 下泄（單孔板） | **75 gpm** (→ 0 on CCW letdown isolation @ 58.3 °C) |
| Seal injection · 軸封注入 | **32 gpm** (4 × 8); 20 to RCS, 12 leakoff to VCT |
| VCT usable volume · 容積控制缸可用容積 | **≈ 300 ft³ (2244 gal)** → level gain 7.43×10⁻⁴ %/(gpm·s) |
| VCT control band · 容積控制缸控制帶 | makeup < **50 %**, setpoint **55 %**, divert > **60 %** |
| VCT low-level makeup / RWST swap · 低液位補水／切換 | **18 %** makeup alarm · **8 %** VCT→RWST suction swap |
| VCT H₂ cover-gas pressure · 氫氣覆蓋氣壓力 | **15–75 psig** (nominal ~22 psig) |
| Boric-acid tank · 硼酸缸 | **≈ 7000 ppm B (≈ 4 wt%)** |
| Blender modes · 混合器模式 | AUTOMATIC (match RCS) / BORATE / DILUTE / ALTERNATE-DILUTE — none writes BoronPpm |

### How to see it · 點睇

Reactor module → gauges: **Charging flow**, **Letdown flow**, **VCT level**, **VCT pressure**, **Makeup /
blend**. Controls: **CVCS makeup blender mode** selector. Annunciators: **VCT LO LVL · MAKEUP**, **VCT HI LVL ·
DIVERT**, **CHG SUCTION → RWST**. Isolate letdown (drive CCW header hot, or run the loss-of-CCW scenario) and
watch the VCT drain into the makeup band and the auto-makeup recover it; charging visibly rises on a draining
pressurizer (negative level error) and on an outsurge.

---

## 2026-06-25 — Main Steam Safety Valves (MSSV): discrete 5-stage staggered ASME Section III secondary-overpressure bank · 主蒸汽安全閥：離散 5 級錯開整定 ASME 第三章二次側超壓保護閥組

**Commit:** [`751a8a9`](https://github.com/codingmachineedge/WinForge/commit/751a8a9) on `feature/reactor-hyper`.

### What it models · 模擬內容

The secondary side had no real overpressure protection — steam-header pressure was simply held under a **hard `Math.Clamp(SteamPressure, 0.3, 8.5)` MPa wall**. That clamp is a fiction: a real plant caps the steam header with **Main Steam Safety Valves**, the steam-line analog of the pressurizer code safeties this sim already models. A Westinghouse 4-loop unit carries **5 MSSVs per steam generator (20 total)** with **staggered lift setpoints** so they pop one stage at a time, and the bank is sized to **~109 % of full-power steam flow** (≈16.47 ×10⁶ lbm/hr vs 15.1 ×10⁶) so it can relieve the worst secondary overpressure transient within the **110 %-of-design ASME limit**.

This run replaces the clamp with a **lumped bank of 5 discrete, latched, pop-action safety valves** on the header (each lumped stage = the 4 same-setpoint valves across the 4 SGs combined):

- **Staggered lift ladder.** Canonical Tech-Spec Table 3.7.1-2 setpoints are **1185 / 1195 / 1207.5 / 1218.5 / 1230 psig** (= 8.272 / 8.341 / 8.427 / 8.503 / 8.582 MPa abs via `MPa_abs = (psig+14.7)/145.038`). The in-sim ladder is shifted into the engine's existing `0.5 + 6.5×` pTarget drive band as **7.60 / 7.80 / 8.00 / 8.20 / 8.40 MPa**, with the clamp raised **8.5 → 9.0 MPa** so the *valves*, not a wall, cap the header.
- **Blowdown / reseat hysteresis.** Each stage latches OPEN at its setpoint and reseats only after a full **0.30 MPa blowdown band** (reseat at 7.30 / 7.50 / 7.70 / 7.90 / 8.10 MPa). The band exceeds the worst single-step pressure swing, so the bank is **chatter-free** at the fixed timestep — the same latch+blowdown pattern as the pressurizer code safeties.
- **Per-stage relief capacity** (fraction of nominal steam flow): **0.16 / 0.20 / 0.22 / 0.22 / 0.20**, summing to **≈1.0** (the certified 109 % oversize, normalized). Relief per open stage scales with overpressure above the lowest open seat (`liftFrac`, a choked-flow surrogate) toward full lift at the **8.6 MPa accumulation** pressure.
- **Folds into the steam balance.** Total relief enters the existing `pTarget` additively — exactly like the condenser steam dump (`−SdPressReliefK·mssvRelief`). So on a **turbine-trip-without-dump / loss-of-load / ATWS**, the header walks **UP** the ladder one stage at a time (1→5 valves) and equilibrates just above the highest open seat (peak < 8.6 MPa, well under the 9.0 backstop), then walks back **DOWN** through the blowdown bands as decay-heat steaming falls. It never gets pinned at a clamp.
- **Cooling/relief ONLY.** The relief term can only *subtract* from the steam balance — it never adds heat — so the meltdown-arm path is untouched.

New telemetry: **`MssvOpenCount`** (0–5), **`MssvReliefFlow`** (normalized), **`MssvLifted`** (bool), a **`MssvValveLifted`** rising-edge event wired to an audible pop cue, and a bilingual **MAIN STEAM SAFETY OPEN / 主蒸汽安全閥起跳** annunciator.

二次側原本冇真正嘅超壓保護——蒸汽母管壓力只係俾一個 `Math.Clamp(SteamPressure, 0.3, 8.5)` MPa 硬鉗位頂住。真實機組係用**主蒸汽安全閥**封頂，即穩壓器規範安全閥喺蒸汽管路上嘅對應件。西屋四環路機組每台蒸汽發生器 **5 個、全廠 20 個**，整定**錯開**令佢逐級跳脫，閥組容量約為**滿功率蒸汽流嘅 109%**，可喺 **110% 設計 ASME 限值**內洩放最惡劣二次側超壓事故。本次將硬鉗位換成母管上 **5 個離散、閂鎖、跳脫式安全閥**（每個合併級＝四台蒸汽發生器同整定嘅 4 個閥合併）。技術規格表 3.7.1-2 整定為 **1185／1195／1207.5／1218.5／1230 psig**，本模型將梯級移入引擎現有 pTarget 驅動帶為 **7.60／7.80／8.00／8.20／8.40 MPa**，鉗位由 8.5 升至 **9.0 MPa**，令**閥門**而非硬牆封頂。各級於本身整定閂鎖開啟，要回落足 **0.30 MPa 壓差帶**先回座（無顫振）；各級釋放容量 **0.16／0.20／0.22／0.22／0.20**，合計 **≈1.0**；釋放量似凝汽器排汽咁加進 `pTarget`。汽輪機跳機無旁路／甩負荷／ATWS 時母管逐級上行（1→5 個閥），喺最高開啟整定之上少少平衡（峰值 < 8.6 MPa），再經壓差帶逐級落番——唔再俾鉗位釘住。只屬冷卻／洩放，唔影響熔毀解鎖路徑。新增 `MssvOpenCount`／`MssvReliefFlow`／`MssvLifted` 遙測、`MssvValveLifted` 上升沿事件（起跳音效）同雙語「主蒸汽安全閥起跳」報警。

### Key quantitative facts · 關鍵定量數據

| Stage 級 | Lift setpoint 整定 (psig / MPa abs) | In-sim lift 模型整定 (MPa) | Reseat 回座 (MPa) | Relief cap 釋放容量 (frac) |
|---|---|---|---|---|
| 1 (lead) | 1185 / 8.272 | 7.60 | 7.30 | 0.16 |
| 2 | 1195 / 8.341 | 7.80 | 7.50 | 0.20 |
| 3 | 1207.5 / 8.427 | 8.00 | 7.70 | 0.22 |
| 4 | 1218.5 / 8.503 | 8.20 | 7.90 | 0.22 |
| 5 (high) | 1230 / 8.582 | 8.40 | 8.10 | 0.20 |

- Bank: **20 valves** (5/SG × 4 SG), **≈109 %** of full steam flow (16.47 vs 15.1 ×10⁶ lbm/hr); blowdown **0.30 MPa**; accumulation **8.6 MPa**; ASME 110 %-design limit **8.444 MPa** (1210 psia). `Math.Clamp` ceiling raised **8.5 → 9.0 MPa** (backstop only). Files: `Services/ReactorSimService.cs`, `Pages/ReactorModule.xaml.cs`.

---

## 2026-06-25 — Tech-Spec OPERATIONAL MODES 1–6 (NUREG-1431 Table 1.1-1): Keff / Tavg / %RTP classification with Schmitt-trigger hysteresis · 技術規格運轉模式 1–6（NUREG-1431 表 1.1-1）：按 Keff／Tavg／額定功率分類連施密特觸發遲滯

**Commit:** [`d5682c1`](https://github.com/codingmachineedge/WinForge/commit/d5682c1) on `feature/reactor-hyper`.

### What it models · 模擬內容

Dozens of features in this sim already cite a licensing **MODE** in their applicability — *"QPTR ≤ 1.02 in **MODE 1**
> 50 % RTP"*, *"restore RCS LEAKAGE in 4 h or be in **MODE 3** in 6 h / **MODE 5** in 36 h"*, *"SDM count-rate
alarm ≥ 15 min in **Modes 1–5**"* — but the plant never actually **tracked which MODE it was in**. This run adds
the formal **OPERATIONAL MODE** as defined by the Westinghouse Standard Technical Specifications (NUREG-1431,
Table 1.1-1): the single licensing-basis plant condition that every LCO applicability statement keys off. It is a
**new, separate** state from the existing UI lifecycle `ReactorMode` (Shutdown/Startup/Run/Tripped/Meltdown) — that
one is a display state machine; this one is the regulatory condition, classified each tick from the already-solved
reactivity / power / temperature signals.

- **Criticality split (MODE 1/2 vs 3–5)** is the Keff = 0.99 boundary. Net reactivity ρ (pcm) recovers the exact
  multiplication factor `CoreKeff = 1 / (1 − ρ·1e-5)`; Keff = 0.99 is **−1010.1 pcm**, *not* the naïve −1000 (the
  linearised `1 + ρ/1e5` crosses 10 pcm early). The MODE-1/2 band sits in the wide ~1000 pcm gap between a
  feedback-balanced critical core (ρ ≈ 0) and an SDM-shut-down core (ρ ≤ −1300 pcm), so a ±100 pcm Schmitt deadband
  cannot chatter.
- **MODE 1 (Power Operation) vs MODE 2 (Startup)** splits a *critical* core on **core thermal power** — neutron power
  **plus decay heat** (`CoreThermalPowerFraction`) — at **5 % RTP**, with a ±0.5 % sticky deadband. (Thermal, not
  neutron, power is the licensing criterion; using the total fraction is the faithful choice even though a tripped
  core is already deeply subcritical and classifies via the criticality test before the power test runs.)
- **MODE 3 / 4 / 5** subdivide a *subcritical* core purely on **average coolant temperature** at the **350 °F
  (176.7 °C)** and **200 °F (93.3 °C)** breakpoints — Hot Standby ≥ 350 °F, Hot Shutdown 200–350 °F, Cold Shutdown
  ≤ 200 °F — each with a 3 °C half-band that widens toward the side currently occupied so the indicated MODE does
  not flicker on numerical Tavg jitter.
- **MODE 6 (Refueling)** is an opt-in **operator latch** (`RefuelingLatch`, default **OFF**) representing vessel
  head closure bolts less than fully tensioned. It is **gated** — honoured only when the core is genuinely cold
  *and* subcritical — so a stale latch can never paint "Refueling" over a hot or critical core, and it is **cleared
  on every reset** (never auto-set/cleared by the per-tick logic).
- **Deterministic & concurrency-safe.** The whole determination is a pure function of the current signals and the
  current MODE (all hysteresis is state-derived) — no timers, no wall-clock, no moving averages — so it behaves
  identically under the concurrent scheduled-reactor runs.

本次新增正式**運轉模式**（西屋標準技術規格 NUREG-1431 表 1.1-1）——即所有 LCO 適用性引用所依據嘅單一發牌基準機組
狀態。此模式與原有 UI 生命週期 `ReactorMode`（停機／啟動／運轉／跳機／熔毀）**分開**：後者為顯示用狀態機，前者為
法規條件，每個時間步由已解算嘅反應性／功率／溫度訊號分類。**臨界劃分（模式 1/2 對 3–5）** 為 Keff = 0.99 邊界：
`CoreKeff = 1/(1 − ρ·1e-5)`，Keff = 0.99 準確對應 **−1010.1 pcm**（非天真嘅 −1000）；該帶位於平衡臨界（ρ≈0）與停堆
（ρ ≤ −1300 pcm）之間約 1000 pcm 寬縫，±100 pcm 施密特死區不會抖動。**模式 1（功率運轉）對模式 2（啟動）** 以堆芯
**熱功率**（中子＋衰變熱）於 **5% 額定功率**劃分，±0.5% 黏滯死區。**模式 3／4／5** 以**平均冷卻劑溫度**於 **350 °F
（176.7 °C）** 及 **200 °F（93.3 °C）** 斷點細分（熱待機 ≥350 °F、熱停機 200–350 °F、冷停機 ≤200 °F），各帶 3 °C
半死區並向當前側加寬。**模式 6（換料）** 為可選操作員閂鎖（`RefuelingLatch`，預設**關閉**），受閘控——僅當堆芯確實
冷態且次臨界時生效，重設時清除。整個判定為純函數（遲滯全由當前模式推導，無計時器），於並行排程運行下行為一致。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Criticality boundary · 臨界邊界 | Keff = 0.99 ⇒ ρ = (0.99−1)/0.99 ·1e5 = **−1010.1 pcm** |
| Keff recovery · Keff 還原 | `CoreKeff = 1 / (1 − ρ·1e-5)` (exact, not the linearised form) |
| Criticality deadband · 臨界死區 | enter −900 pcm (Keff 0.99108) / exit −1100 pcm (Keff 0.98912), ±100 pcm sticky |
| MODE 3 ↔ 4 breakpoint · 模式 3↔4 斷點 | Tavg = 350 °F = **176.7 °C** |
| MODE 4 ↔ 5 breakpoint · 模式 4↔5 斷點 | Tavg = 200 °F = **93.3 °C** |
| Tavg deadband · Tavg 死區 | ±3.0 °C half-band, widens toward occupied side |
| MODE 1 ↔ 2 split · 模式 1↔2 劃分 | core thermal power (neutron + decay heat) at **5 % RTP** |
| Power deadband · 功率死區 | enter 5.5 % / exit 4.5 % RTP, ±0.5 % sticky |
| MODE 6 gate · 模式 6 閘 | `RefuelingLatch` AND ρ < −1100 pcm AND Tavg < 93.3 °C |
| Enum numbering · 列舉編號 | `(int)TsMode` == published MODE number (1–6) |

### New operator-visible elements · 新增可見元素

- **Status banner** now shows the formal MODE next to the lifecycle mode, bilingual — e.g. `Mode: Run · MODE 1 —
  Power Operation (Keff 1.0000) · 12.3 min` / `模式：運轉 · 模式 1 — 功率運轉 (Keff 1.0000)`.
- **Telemetry:** `TsMode` (enum 1–6), `TsModeNumber` (int), `TsModeStatusEn` / `TsModeStatusZh` (bilingual label),
  `CoreKeff`, `CoreThermalPowerFraction`, and the operator-settable `RefuelingLatch`.
- The six labels: **MODE 1 — Power Operation · 功率運轉**, **MODE 2 — Startup · 啟動**, **MODE 3 — Hot Standby ·
  熱待機**, **MODE 4 — Hot Shutdown · 熱停機**, **MODE 5 — Cold Shutdown · 冷停機**, **MODE 6 — Refueling · 換料**.

### Screenshots · 截圖

Skipped this run — the scheduled-run environment cannot be granted reactor-GUI screen-capture access unattended,
so the panel was not launched (to avoid a stray process). The change is verified by a clean `dotnet build`
(**0 errors**). · 本次略過：排程環境無法在無人值守下授予截圖權限，故未啟動反應堆面板（以免遺留程序）。改動已以
乾淨建置（**0 錯誤**）驗證。

---

## 2026-06-25 — Gravity rod-drop after a trip: trip-breaker/gripper release delay + dashpot kinematics → time-resolved scram reactivity S-curve · 跳堆後控制棒重力下插：斷路器／夾爪釋放延時連緩衝器運動學，產生隨時間展開嘅停堆負反應性 S 曲線

**Commit:** [`388e69b`](https://github.com/codingmachineedge/WinForge/commit/388e69b) on `feature/reactor-hyper`.

### What it models · 模擬內容

Until now, `Scram()` **snapped every control bank to 100 % inserted in a single tick** — the full ~8000 pcm of
rod worth appeared instantly. Real RCCAs do nothing of the sort. On a reactor trip the **reactor trip breakers
(RTA/RTB)** open (each via a de-energize-to-trip undervoltage coil plus a diverse shunt coil), AC to the CRDM
rod-power cabinets is removed, the **stationary/movable gripper-coil magnetic flux decays (L/R)** and the latches
release, and only then do the rods **fall under gravity** — drag-limited through the active core, then hydraulically
**snubbed in the dashpot** over the bottom ~15 % of travel. This run replaces the instant snap with that physical chain.

- **Release dead-time.** A lumped `ROD_RELEASE_DELAY_S = 0.30 s` holds the rods at their pre-trip position after
  the trip latches — sensor + 2-of-4 coincidence logic (~0.1 s) + breaker mechanical open (~0.05 s, 2–5 cycles) +
  gripper-coil flux decay & latch release (~0.10–0.15 s). The whole chain is **fail-safe (de-energize-to-release)**.
- **Two-regime drop kinematics.** Each bank's insertion fraction integrates toward 1.0 every 0.02 s substep
  (`StepRodDrop` → `AdvanceRodDrop`): constant **drag-limited free-fall velocity** `0.386 stroke/s` until the
  **dashpot-entry fraction 0.85**, then a decelerating **dashpot snubbing** velocity (factor 0.40 floored) over the
  bottom 15 %. Time to dashpot entry ≈ **2.2 s** from rod motion (the Tech-Spec rod-drop-time basis), full seating
  ≈ 2.8 s from motion / ≈ 3.1 s from the trip latch.
- **The S-curve falls out for free.** Driving the insertion fraction through the *existing* integral-worth curve
  `RodS(x) = x − sin(2πx)/(2π)` (the exact integral of the chopped-cosine differential worth `1 − cos 2πx`, which
  peaks at the high-worth core mid-plane) reproduces the **canonical Chapter-15 normalized scram curve** with **no
  new reactivity math**: ~**2 / 19 / 54 / 87 %** of trip worth in by **0.5 / 1.0 / 1.5 / 2.0 s** from rod motion.
  ~87 % is inserted by 2 s even though the rod is only ~85 % in, because the low-worth core bottom adds little.
- **Emergent prompt drop + tail.** The point-kinetics solver now sees a *ramping* negative reactivity, so the
  prompt drop appears naturally once net ρ < −β, and power decays onto the delayed-neutron / decay-heat tail instead
  of stepping to zero — every trip transient (LOFW, LOCA, turbine trip, overpower) gets a realistic early power shape.
- **ATWS preserved & extended.** `_rodsFailToInsert` skips the release timer **and** the drop, and gates the
  per-substep advance, so an ATWS that develops **mid-drop** freezes the rods at their current partial fraction
  rather than continuing to seat. Banks already fully in don't move; a lead bank's pre-trip partial insertion
  correctly shortens its own drop.

直到今次，`Scram()` 會喺**單一時間步將每組控制棒瞬間插到 100%**——成 ~8000 pcm 棒價即時出現，與真實控制棒組件
完全唔同。實際跳堆時：**跳脫斷路器（RTA／RTB）**打開（各靠失電跳脫嘅低電壓線圈連多樣性分勵線圈），切斷控制棒
驅動機構電源，**夾爪線圈磁通（L/R）衰減**、鎖扣釋放，跟住棒先至**靠重力下插**——喺活性區受阻力限制，再喺底部
約 15% 行程經**緩衝器（dashpot）水力制動**。本次以呢條物理鏈取代瞬間插入：合計 `ROD_RELEASE_DELAY_S = 0.30 秒`
釋放死區（感測＋2/4 符合邏輯＋斷路器開＋夾爪磁通衰減，整個為失電釋放、故障安全）；每 0.02 秒子步將插入比例趨向
1.0——`0.386 行程／秒`阻力限制自由落體直至 **0.85 緩衝器入口**，再以制動速度（係數 0.40，有下限）行底部 15%；
離開棒運動約 **2.2 秒**到緩衝器入口（技術規格落棒時間依據），約 2.8 秒（離跳堆閂約 3.1 秒）完全到底。經由*原有*積分
棒價曲線 `RodS(x)=x−sin(2πx)/(2π)`（截斷餘弦微分棒價之精確積分，喺高棒價爐芯中平面達峰）即**重現第15章標準停堆
曲線而毋須新反應性運算**：離開棒運動 0.5／1.0／1.5／2.0 秒時約插入 **2／19／54／87%** 跳堆價值；點動力學求解器
今見到*斜升*嘅負反應性，瞬發跌落自然出現，功率沿緩發中子／衰變熱尾衰減而非瞬間歸零。`_rodsFailToInsert`（ATWS）
會跳過釋放計時與下插，連下插中途轉 ATWS 都會將棒凍結於當前比例；已到底嘅棒唔郁，領先棒跳堆前嘅部分插入會正確
縮短其落棒。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Trip-breaker + gripper release delay · 斷路器＋夾爪釋放延時 | `ROD_RELEASE_DELAY_S` = 0.30 s (FSAR Ch.15 credits ≤0.5 s) |
| Reactor-trip-breaker open time · 跳脫斷路器開啟時間 | ~35–80 ms (2–5 cycles), credit ~50 ms |
| Gripper-coil flux decay / latch release · 夾爪磁通衰減／鎖扣釋放 | ~100–150 ms |
| Free-fall (drag-limited) velocity · 阻力限制自由落體速度 | 0.386 stroke/s |
| Dashpot-entry fraction · 緩衝器入口比例 | 0.85 (bottom ~15 % = ~34 of 228 steps) |
| Dashpot velocity factor · 緩衝器速度係數 | 0.40 (floored at 0.02 stroke/s) |
| Rod-drop time to dashpot entry · 落棒到緩衝器入口 | ≈ 2.2 s from rod motion (Tech-Spec basis ≤ 2.2–2.7 s) |
| Full seating · 完全到底 | ≈ 2.8 s from motion / ≈ 3.1 s from trip latch |
| Total rod worth · 控制棒總價值 | `TotalRodWorth` = 0.080 Δk/k (8000 pcm) |
| Differential worth shape · 微分棒價形狀 | dW/dx ∝ (1 − cos 2πx), chopped cosine (peaks mid-plane) |
| Scram-curve milestones · 停堆曲線里程碑 | ~2 / 19 / 54 / 87 % at 0.5 / 1.0 / 1.5 / 2.0 s from rod motion |
| Full rod stroke · 控制棒全行程 | 228 steps × 5/8 in = 142.5 in (~12 ft active fuel) |

### New operator-visible elements · 新增可見元素

- **Status line phases** (bilingual): the `SCRAM` status now annotates `· trip breakers open` → `· rods dropping`
  → (or) `· ATWS: rods failed to insert`, so the operator can see the rods fall over the first few seconds.
- **Telemetry:** `RodsDropping` (bool), `RodDropElapsedS`, `RodReleaseRemainingS`, `ScramReactivityInsertedPcm`
  (0 → ~8000 pcm as the banks seat) and `ScramReactivityFraction` (0–1, for plotting the scram curve).
- The rod-position indication now visibly **streams in over ~3 s** on any trip instead of jumping to full-in.

### Screenshots · 截圖

Skipped this run — the scheduled-run environment cannot be granted reactor-GUI screen-capture access unattended,
so the panel was not launched (to avoid a stray process). The change is verified by a clean `dotnet build`
(**0 errors**). · 本次略過：排程環境無法在無人值守下授予截圖權限，故未啟動反應堆面板（以免遺留程序）。改動已以
乾淨建置（**0 錯誤**）驗證。

---

## 2026-06-25 — Component Cooling Water (CCW) + Service Water / Ultimate Heat Sink support-cooling chain · 設備冷卻水連廠用海水／最終熱阱支援冷卻系統

**Commit:** [`5a0c783`](https://github.com/codingmachineedge/WinForge/commit/5a0c783) on `feature/reactor-hyper`.

### What it models · 模擬內容

The RCP seal-LOCA model already escalated through the **WOG-2000 leakoff bins** whenever seal cooling was
lost — but "thermal-barrier cooling available" was a **proxy**: it was simply `AnyAcBusEnergized`. There was
no actual cooling-water system behind it. This run builds that missing **support-cooling chain** — the
intermediate, closed-loop **Component Cooling Water (CCW)** system and the **Essential Service Water (ESW) /
Ultimate Heat Sink (UHS)** it rejects to — and rewires the seal model to read the *real* signal.

- **Lumped two-node thermal cascade.** The UHS supply temperature is a boundary input; ESW cools the **CCW
  heat exchangers**, whose outlet is the CCW **cold leg** feeding the served loads; the components return heat
  to the CCW **hot leg** (HX inlet). Both nodes integrate with the engine's standard **clamped first-order
  relaxation** (`Math.Min(1, dt/τ)`, no stiff exponentials).
- **Served heat load = base + RCP + RHR.** A base load (letdown / non-regenerative HX + seal-water HX + misc),
  plus a **per-running-RCP** term (motor air/oil/bearing + thermal-barrier coolers), plus a **dominant RHR-HX**
  term that is active *only* in shutdown-cooling alignment (RCS below ~177 °C / 350 °F) and **scaled by the
  decay-heat fraction**. At power the RHR term is zero, so the calibrated full-power steady state is untouched.
- **Real thermal-barrier signal.** New `CcwThermalBarrierCoolingOk` (CCW pumps on a vital AC bus ∧ flow ∧ UHS
  within limit ∧ supply leg cold enough) now feeds `StepSeals`' `barrierOk` in place of the old AC-bus proxy.
  So **loss of CCW** (new scenario), a **containment-isolation Phase-B CCW dump**, a **station blackout**, or a
  **UHS over-temperature** all heat the RCP thermal barriers — and, if seal injection is also gone, drive the
  seal cavities up the existing WOG-2000 bins toward a seal LOCA. The classic loss-of-CCW pathway, emergent.
- **Auto letdown isolation.** When the non-regenerative-HX outlet (CCW hot leg) reaches the high-temperature
  setpoint, letdown auto-isolates (latched, protecting the purification demineraliser resins).

反應堆主泵軸封失水模型本已能依 **WOG-2000 洩漏分箱**逐級惡化，但「熱障冷卻是否可用」一直只是用
`AnyAcBusEnergized` **代替**，背後並無真正冷卻水系統。本次補上呢條缺失嘅**支援冷卻鏈**——中間閉式
**設備冷卻水（CCW）**系統，連佢排熱去嘅**廠用海水（ESW）／最終熱阱（UHS）**——並將軸封模型改為讀取*真實*訊號：
集總兩節點熱級聯（最終熱阱供水→CCW 冷段→CCW 熱段，沿用夾持一階弛豫）；被冷卻熱負荷＝基本＋每台運行主泵＋
僅停堆冷卻對齊（RCS 低於約 177 °C）時生效且以衰變熱比例縮放嘅 RHR 主負荷（滿功率時為零，穩態不變）；新嘅
`CcwThermalBarrierCoolingOk` 取代舊代替判據去餵軸封 `barrierOk`，故喪失 CCW、Phase-B CCW 切除、全廠斷電或
最終熱阱超溫，都會令主泵熱障升溫，若軸封注入亦喪失則沿既有 WOG-2000 分箱走向軸封失水；非再生熱交換器出口高溫
時淨化下泄自動隔離（鎖存，保護除鹽樹脂）。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| CCW cold (supply) nominal · CCW 冷段標稱 | 35 °C (95 °F) |
| CCW design-max temperature · CCW 設計上限 | 48.9 °C (120 °F) |
| CCW header-hi alarm · CCW 母管高溫報警 | 46.1 °C (115 °F) |
| Non-regen-HX letdown-isolation temp · 非再生熱交換器下泄隔離溫度 | 58.3 °C (137 °F) |
| UHS / service-water Tech-Spec max · 最終熱阱技術規格上限 | 35 °C (95 °F), SR 3.7.9.1 |
| CCW low-flow alarm · CCW 低流量報警 | < 50 % design flow |
| Surge-tank lo / hi alarm · 穩壓缸低／高水位報警 | 25 % / 88 % |
| HX rated duty · 熱交換器額定換熱量 | 22.6 MWth (≈77.2×10⁶ BTU/hr) |
| RHR-HX load at full decay heat · 滿衰變熱 RHR 負荷 | 30 MWth (shutdown cooling only) |
| Per-RCP CCW load · 每台主泵 CCW 負荷 | 1.2 MWth |
| RHR cut-in temperature · RHR 投入溫度 | 177 °C (350 °F) |
| Tech-Spec basis · 技術規格依據 | LCO 3.7.7 (CCW) / 3.7.8 (ESW) / 3.7.9 (UHS) |

### New operator-visible elements · 新增可見元素

- **Scenario:** *Loss of component cooling water (LCO 3.7.7)* — collapses CCW flow; the header soaks toward a
  hot stagnation datum, arming the high-temp alarm, letdown isolation and (with seal injection lost) a seal LOCA.
- **Gauge:** *Component cooling water* — CCW supply temp, with a readout of cold/hot legs, served flow %, load
  (MW), and `NO CCW` / `LTDN ISO` flags.
- **Alarms (5):** CCW header temp hi, CCW low flow, CCW surge-tank abnormal, UHS temp hi, letdown isolated (CCW).

### Screenshots · 截圖

Skipped this run — per the scheduled-run environment, the reactor GUI cannot be granted screen-capture access
unattended, so the panel was not launched (to avoid a stray process). The change is verified by a clean
`dotnet build` (**0 errors**). · 本次略過：排程環境無法在無人值守下授予截圖權限，故未啟動反應堆面板（以免遺留
程序）。改動已以乾淨建置（**0 錯誤**）驗證。

---

## 2026-06-25 — Pressurizer Relief Tank (PRT) — quench-tank mass/energy model + 100-psig rupture disc venting to containment · 穩壓器釋壓缸——急冷缸質能模型連 100 psig 爆破片洩往安全殼

**Commit:** [`3b2a39c`](https://github.com/codingmachineedge/WinForge/commit/3b2a39c) on `feature/reactor-hyper`.

### What it models · 模擬內容

The sim already modelled the pressurizer **PORV** and three **ASME code safety valves**, but their
discharge simply vanished — pressure was decremented into a void. Real Westinghouse plants route every one
of those reliefs, through a sparger, into the **Pressurizer Relief Tank (PRT)** — a passive quench tank of
subcooled water under a **nitrogen cover gas** that condenses the discharged steam. This run adds that tank
as a lumped mass/energy node, so the PRT now **heats up, pressurizes and fills** whenever a relief path is
open — and bursts its **rupture disc** if a relief sticks open:

- **Water pool — first-law open-system balance.** The discharge the PORV/safety logic already produces
  (tracked as an equivalent primary-pressure decrement) is converted to a steam mass flow (~**30 kg/s** for a
  stuck-open PORV) carrying saturated-steam enthalpy **≈ 2.595 MJ/kg** (at the ~16.2 MPa relief setpoint). The
  pool mass and temperature integrate that incoming enthalpy minus the pool's own, so the water **warms** as
  it quenches the steam.
- **Cover-gas pressure.** PRT total pressure = **N₂ partial pressure** (ideal gas, fixed mass, compressed as
  the condensate raises the water level and shrinks the gas space) **+ the water-vapour partial pressure** of
  the warming pool (Buck saturation equation). Both rise together, so a hot PRT is also a high-pressure PRT.
- **Rupture disc → containment.** A latching, non-reclosing **rupture disc bursts at ~100 psig** and vents the
  tank to containment, adding a pressurization drive and dumping the inventory toward the **sump** — exactly
  the path by which a stuck-open PORV floods a containment basement.
- **Why it matters (the TMI-2 lesson).** A **rising, hot PRT** (temperature, pressure and level all climbing
  with no relief *commanded*) is the canonical diagnostic that a PORV or code safety is **leaking or stuck
  open**. At Three Mile Island Unit 2 (1979) the open-PORV indication was a valve-*command* light, not
  valve-*position*; the genuinely-hot relief tank was the real cue the valve had stuck open. Modelling the PRT
  turns that into a readable instrument.

模擬本來已經有穩壓器 **PORV** 同三個 **ASME 規範安全閥**，但佢哋嘅排放憑空消失——壓力只係扣去虛空。真實西屋
電廠會將每一路釋壓，經噴灑器送入**穩壓器釋壓缸（PRT）**——一個氮氣覆蓋下嘅過冷水急冷缸，將排出嘅蒸汽凝結。
本次將呢個缸加入做集總質能節點，所以一有釋壓閥開，釋壓缸就會**升溫、升壓、上水**；若釋壓閥卡開，**爆破片**就爆：

- **水池——開放系統第一定律平衡**：將閥邏輯已產生嘅排放（以等效一次側壓降追蹤）換算成蒸汽質量流量（卡開
  PORV 約 **30 kg/s**），帶飽和蒸汽焓 **約 2.595 MJ/kg**（約 16.2 MPa 釋壓整定）。水池質量同溫度積分入口焓減
  去水池本身焓，所以水池一邊急冷蒸汽一邊**升溫**。
- **覆蓋氣壓力**：釋壓缸總壓 = **氮氣分壓**（理想氣體、固定質量，凝結水抬升水位、壓縮氣空間）**＋升溫水池嘅
  水蒸氣分壓**（Buck 飽和方程）。兩者齊升，所以熱嘅釋壓缸亦係高壓嘅釋壓缸。
- **爆破片 → 安全殼**：閂鎖、不回座嘅**爆破片喺約 100 psig 爆裂**，將缸洩往安全殼，產生升壓驅動並將存量倒入
  **集水坑**——正正係卡開 PORV 淹浸安全殼底層嘅途徑。
- **點解重要（三哩島教訓）**：**升溫又上壓嘅釋壓缸**（溫度、壓力、水位齊升而無人指令釋壓）係 PORV 或規範安全閥
  **洩漏或卡開**嘅典型徵兆。1979 年三哩島二號機，PORV「開」指示其實係閥**指令**燈而非閥**位置**；真正變熱嘅
  釋壓缸先係閥卡開嘅真實線索。模擬釋壓缸令呢個徵兆變成可讀儀表。

### Key quantitative facts / parameters · 關鍵數據／參數

| Parameter · 參數 | Value · 數值 |
|---|---|
| Tank volume · 缸容積 | 51 m³ (~1800 ft³), Westinghouse 4-loop |
| Normal water inventory · 正常水量 | ~33 000 kg (~65 % full) |
| Normal pool temperature · 正常水溫 | 49 °C / 120 °F |
| N₂ cover-gas blanket · 氮氣覆蓋壓力 | ~1.2 bar abs (~3 psig) |
| Incoming steam enthalpy · 入口蒸汽焓 | ≈ 2.595 MJ/kg (sat. steam at ~16.2 MPa) |
| Stuck-open-PORV discharge · 卡開 PORV 排放 | ~30 kg/s |
| **Rupture-disc burst setpoint · 爆破片爆裂整定** | **100 psig (0.79 MPa abs)** |
| High-pressure alarm · 高壓警報 | 8 psig |
| High-temperature alarm · 高溫警報 | 60 °C / 140 °F |
| Level alarms (hi / lo) · 水位警報（高／低） | 92 % / 50 % |

> Setpoint note · 整定備註: the **100 psig** burst is the Westinghouse 4-loop UFSAR figure. The ~200 psig
> value sometimes quoted is the **TMI-2 (B&W)** disc and applies to a different plant class — used here only
> as the diagnostic-training narrative, not as the constant.

### Telemetry & alarms · 遙測與警報

Three new gauges — **PRT pressure** (psig, with `discharging` / `DISC BURST` annotation), **PRT temp** (°F),
**PRT level** (%) — plus four new bilingual annunciators: **PRT PRESS HI**, **PRT TEMP HI**,
**PRT LEVEL ABNORMAL**, **PRT RUPTURE DISC BURST**.

三個新錶——**釋壓缸壓力**（psig，附「排放中／爆破片爆」標註）、**釋壓缸溫度**（°F）、**釋壓缸水位**（%）——
加四個新雙語警報：**釋壓缸壓力高**、**釋壓缸溫度高**、**釋壓缸水位異常**、**釋壓缸爆破片爆裂**。

### Safety / non-destructiveness · 安全性／非破壞性

The PRT is **one-way coupled**: it only *consumes* the relief decrement the existing valve logic already
produces and **never writes RCS pressure**, so enabling it cannot destabilise the calibrated primary loop.
The rupture disc and its containment/sump coupling stay **inert until a disc actually bursts** (an emergent
consequence of a sustained stuck-open relief, not a toggle), and the alarms are read-only. No meltdown-arm
or real-shutdown behaviour is touched.

釋壓缸為**單向耦合**：只**消耗**現有閥邏輯產生嘅釋壓量，**絕不改寫 RCS 壓力**，所以啟用佢唔會擾亂已校準嘅
一次側。爆破片同其安全殼／集水坑耦合，**喺爆破片真正爆裂之前一直惰性**（係持續卡開釋壓嘅湧現後果，並非開關），
警報亦只讀。完全唔觸碰熔毀啟動或真實關機行為。

### Screenshots · 截圖

Skipped this run — per the scheduled-run environment, interactive computer-use screenshot access cannot be
granted unattended, so the app was not launched (no stray process left behind). The change is verified by a
clean `dotnet build -c Debug -p:Platform=x64` (0 errors). · 本次略過：排程環境無法在無人值守下取得互動式
螢幕截圖權限，故未啟動程式（亦無遺留程序）。改動已以乾淨建置（0 錯誤）驗證。

---

## 2026-06-25 — Regenerative feedwater-heating train + final feedwater temperature, with the FSAR 15.1.1 loss-of-feedwater-heating overcooling event · 再生式給水加熱系統連最終給水溫度，加 FSAR 15.1.1 喪失給水加熱過冷事故

**Commit:** [`08f2a6a`](https://github.com/codingmachineedge/WinForge/commit/08f2a6a) on `feature/reactor-hyper`.

### What it models · 模擬內容

Until now feedwater simply *gated* the steam-generator heat sink — it had no **temperature**. Real PWRs
deliver feedwater to the SGs hot (~227 °C / ~440 °F), reheated from the condenser hotwell across a
**regenerative feedwater-heating train** (≈ 4 LP heaters + a deaerator + 2 HP heaters) using turbine
extraction steam. This run adds that train and the **final feedwater temperature**, then couples it back
into the primary so the classic **loss-of-feedwater-heating** overcooling transient emerges:

- **Final feedwater temperature.** A single effective regenerative heater raises condensate from the
  condenser-hotwell saturation (~38 °C / ~100 °F at ~2.0 inHgA) toward **~227 °C (~440 °F)** at full load.
  Because the extraction pressures driving the heaters track turbine load, the terminal temperature is
  **load-programmed** (≈ 210 °C at 75 %, ≈ 186 °C at 50 %) via a concave curve, scaled by a *heaters-in-service*
  fraction and a **~30 s** first-order thermal lag.
- **Secondary→primary coupling.** Colder-than-programmed feedwater means the SG must absorb the extra sensible
  enthalpy to reheat it, so primary heat extraction rises. The model adds a **one-sided, steam-flow-weighted**
  removal term proportional to the temperature *deficit* below the program. It is **≈ 0 with the full train in
  service** (so the calibrated at-power steady state is untouched) and self-zeros at low/zero load.
- **FSAR 15.1.1 "Decrease in Feedwater Temperature" scenario (ANS Condition II).** Tripping one HP-heater
  string drops the final feedwater temperature **~28 °C (~50 °F)**. The primary cools a few °C; with a
  **negative MTC** (most negative at EOC, the limiting case) the cooldown inserts **tens-to-~100 pcm** of
  positive reactivity and reactor power rises **~2–5 % RTP**. There is **no reactor trip** — the event is
  absorbed by Doppler self-limiting and the existing **Tavg/Tref auto rod control** (Tavg falls below Tref →
  rods withdraw to restore Tavg), exactly as in plant safety analysis.

至今給水只係**閘控**蒸發器熱阱，並無**溫度**。真實壓水堆嘅給水以高溫（約227°C／440°F）送入蒸發器，經
**再生式給水加熱系統**（約 4 台低壓加熱器＋除氧器＋2 台高壓加熱器）用汽輪機抽汽逐級加熱。本次加入呢個系統
同**最終給水溫度**，再耦合返一次側，令經典嘅**喪失給水加熱**過冷暫態自然湧現：

- **最終給水溫度**：單一等效再生加熱器把凝結水由凝汽器熱井飽和溫度（約2.0 inHgA 下約38°C／100°F）升到滿載
  約**227°C（440°F）**。由於驅動加熱器嘅抽汽壓力隨負荷變化，終端溫度按**負荷編程**（75 % 約210°C、50 % 約
  186°C），再乘以*加熱器在役*比例同約 **30 秒**一階熱滯後。
- **二次側→一次側耦合**：給水低過編程值，蒸發器要多吸收顯熱去翻熱佢，一次側抽熱因而增加。模型加入一個
  **單向、按蒸汽流量加權**、與低於編程值之**溫差**成比例嘅抽熱項。全列加熱器在役時**約為零**（唔影響已校準
  嘅功率穩態），低／零負荷時亦自動歸零。
- **FSAR 15.1.1「給水溫度下降」情景（ANS 第二類事件）**：跳脫一台高壓加熱器令最終給水溫度跌約 **28°C
  （50°F）**。一次側冷卻幾°C；憑**負慢化劑溫度係數**（壽期末最負、為限制工況）注入 **數十至約100 pcm** 正
  反應性，反應堆功率升 **約2–5 % 額定**。**唔會跳堆**——由都卜勒自限同既有 **Tavg／Tref 自動棒控**（Tavg
  跌穿 Tref → 抽棒回復 Tavg）吸收，與電廠安全分析一致。

### Key quantitative facts · 關鍵量化數據

| Parameter · 參數 | Value · 數值 |
|---|---|
| Final feedwater temp @ 100 % load · 滿載最終給水溫度 | ~227 °C / ~440 °F |
| Condenser-hotwell / condensate temp · 凝汽器熱井／凝結水溫度 | ~38 °C / ~100 °F (~2.0 inHgA) |
| Heating stages · 加熱級數 | ~7 (4 LP + deaerator + 2 HP) |
| Load curve · 負荷曲線 | 75 % → ~210 °C · 50 % → ~186 °C (exponent 0.35) |
| Heater-train thermal lag · 加熱系統熱滯後 | ~30 s (first-order) |
| Loss of one HP heater string · 失一台高壓加熱器串 | final FW temp −28 °C (−50 °F) |
| EOC MTC (limiting) · 壽期末慢化劑溫度係數（限制） | ~ −54 … −90 pcm/°C |
| Positive reactivity inserted · 注入正反應性 | tens … ~100+ pcm |
| Power rise (no trip) · 功率上升（不跳堆） | ~2–5 % RTP |
| Coupling gain (one-sided, steam-flow-weighted) · 耦合增益 | 0.12 sgRemoval-units per (°C-deficit × steam-flow) |

### New instruments & controls · 新增儀表與控制

- **Final feedwater temp gauge · 最終給水溫度錶** (°F) with a full-load setpoint tick (440 °F) and a
  "1 HP heater lost" tick (390 °F); shows the live temperature deficit when feedwater heating is degraded.
- **LOW FEEDWATER TEMP (15.1.1) · 給水低溫（15.1.1）** annunciator on the alarm panel.
- **Loss of feedwater heating (Ch 15.1.1) · 喪失給水加熱（15.1.1）** entry in the scenario picker.

### Why this is safe for the existing model · 對既有模型為何安全

The coupling term is the clamped, one-sided deficit `max(0, programmed − actual)`, which is ~0 whenever the
full heater train is in service — so the calibrated full-power steady state is provably unchanged — and it is
multiplied by steam flow, so it also self-zeros at low/zero power (leaving the cold-zero-power region
undisturbed). · 耦合項為截斷單向溫差 `max(0, 編程值 − 實際值)`，全列加熱器在役時約為零，故已校準嘅滿功率
穩態可證不變；再乘以蒸汽流量，低／零功率時亦歸零，唔擾動冷態零功率區。

### Screenshots · 截圖

Skipped this run — computer-use screenshot access cannot be granted in the unattended scheduled-run
environment, and launching the freshly-built app risks the known cold-zero-power supercritical bug. The
change is verified by a clean `dotnet build -c Debug -p:Platform=x64` (0 errors). · 本次略過：排程無人值守
環境無法授予 computer-use 截圖權限，且啟動新建程式有觸發已知冷態零功率超臨界錯誤之風險。改動已以乾淨建置
（0 錯誤）驗證。

### Research · 研究

Quantitative facts and the numerically-stable coupling were produced by a focused multi-agent **ultracode**
research pass (Workflow tool): three parallel research agents (feedwater temperatures / FSAR 15.1.1 transient /
lumped-model approach) feeding a synthesis agent. Sources: Westinghouse 4-loop UFSAR steam-and-power-conversion
chapters (Sequoyah/Watts Bar/SNUPPS-class), EPRI heat-balance diagrams, FSAR Ch. 15.1. · 量化數據與數值穩定
耦合由聚焦多代理 **ultracode** 研究產生（三個並行研究代理＋一個綜合代理）。

---

## 2026-06-25 — Main generator electrical model: excitation/AVR reactive power + grid synchroscope + ANSI generator protection · 主發電機電氣模型：勵磁／自動電壓調節無功＋併網同步示波器＋ANSI 發電機保護

**Commit:** [`94ce3f5`](https://github.com/codingmachineedge/WinForge/commit/94ce3f5) on `feature/reactor-hyper`.

### What it models · 模擬內容

Until now the turbine produced only **real power** (MWe) — the generator's *electrical* side was missing.
This run adds the synchronous **main generator** as a proper electrical machine on top of the existing EHC.
The governor sets real power **P**; the **excitation / AVR** now sets reactive power **Q**, and from those two
the model derives the full control-room electrical picture, plus grid synchronization and protective relaying:

- **Excitation / AVR (reactive power).** Four selectable modes, all clamped to the reactive-**capability
  (D-) curve** (+567 MVAR overexcited rotor/field-heating limit, −350 MVAR underexcited end-core/stability
  limit): **Constant-PF** (default, 0.90 lagging → Q = P·tan(acos PF), ~557 MVAR at full load), **Auto-voltage**
  (droop-compensated terminal-voltage regulator), **Constant-MVAR**, and **Manual field**. A first-order
  exciter lag (τ ≈ 0.5 s) tracks Q to demand. Terminal voltage (24 kV), power factor (lead/lag), field current
  (~1.0 p.u. at rated), and stator ammeter current all fall out algebraically.
- **Grid frequency & synchroscope.** Frequency is locked to **60.0 Hz** when synchronized, otherwise derived
  from shaft speed. While the breaker is open a phase-angle integrator (∫ slip dt) drives a synchroscope, and
  an **ANSI-25 sync-check** asserts only inside the close window (≤ 0.067 Hz slip, ± 10°, ± 5 % volts). An
  optional **sync interlock** (default **OFF**, so the existing breaker toggle is unchanged) gates closing.
- **Generator protective relays (ANSI device numbers).** **32** reverse-power (sequential anti-motoring),
  **40** loss-of-field (two MVAR/impedance zones), **24** volts-per-hertz overexcitation, **27/59** under/over-
  voltage, **81O/81U** over/under-frequency. Each uses a definite-time accumulated-time-above-pickup timer and
  fires a single **86 lockout** `GeneratorTrip()` that opens the breaker and calls the existing `TripTurbine()`;
  the **pre-existing anticipatory reactor-trip permissive** (armed on an open generator breaker at power) does
  the rest. Hand-reset, like the turbine trip.

至今汽輪機只產生**實功率**（MWe），缺少發電機的**電氣**側。本次在既有電液調速之上，把同步**主發電機**加為
完整電氣機械：調速器設實功率 **P**，**勵磁／自動電壓調節（AVR）**現設無功 **Q**，再導出整個控制室電氣畫面，
連同併網與保護繼電。**勵磁／AVR（無功）**：四種模式，全部受無功**能力曲線**箝位（過勵 +567 MVAR 轉子加熱
限值、欠勵 −350 MVAR 定子端鐵心／穩定限值）——**固定功率因數**（預設 0.90 滯後，Q = P·tan(acos PF)，滿載約
557 MVAR）、**自動電壓**（含下垂補償）、**固定無功**、**手動勵磁**；勵磁機一階滯後（τ ≈ 0.5 s）。機端電壓
（24 kV）、功率因數（超前／滯後）、勵磁電流（額定約 1.0 pu）、定子電流皆代數導出。**電網頻率與同步示波器**：
併網時鎖定 **60.0 Hz**，否則按軸轉速；斷路器打開時相角積分器驅動示波器，**ANSI-25 同步檢查**僅於合閘窗口內
成立（轉差 ≤ 0.067 Hz、± 10°、電壓 ± 5 %）；可選**同步聯鎖**（預設**關**，故既有合閘鍵不變）。**保護繼電器**
（ANSI）：**32** 逆功率（順序防電動化）、**40** 失磁（兩區）、**24** V/Hz 過勵、**27/59** 低／過電壓、**81O/81U**
過／低頻；各用定時計時器，觸發單一 **86 閉鎖** `GeneratorTrip()`，打開斷路器並呼叫既有 `TripTurbine()`，其餘
由既有預期反應堆跳脫許可完成；與汽輪機跳脫一樣手動重置。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Nameplate · 銘牌 | 1300 MVA · 24 kV · 0.90 PF lag · 1800 rpm 4-pole · 60 Hz |
| Rated operating point · 額定運轉點 | 1150 MW → S = 1277.8 MVA, **Q ≈ 557 MVAR** lagging |
| Reactive capability · 無功能力 | overexcited +567 MVAR · underexcited −350 MVAR |
| Field current · 勵磁電流 | ~1.0 p.u. at rated; ceiling ~2.6 p.u. |
| Stator current (rated) · 定子電流（額定） | ~30,700 A at 24 kV |
| AVR exciter lag / droop · 勵磁滯後／下垂 | τ ≈ 0.5 s · 5 % reactive droop |
| Sync-check (25) window · 同步檢查窗口 | ≤ 0.067 Hz slip · ± 10° · ± 5 % volts |
| 32 reverse power · 逆功率 | P < −1 % rated (−11.5 MW), 30 s (sequential) |
| 40 loss of field · 失磁 | Q < −0.60 p.u. @ 0.75 s · Q < −1.00 p.u. @ 0.20 s |
| 24 volts-per-hertz · 過勵 V/Hz | > 1.20 p.u. V/Hz, 2 s |
| 27 / 59 voltage · 低／過電壓 | 27: < 0.80 p.u. @ 2 s · 59: > 1.10 @ 5 s / > 1.30 @ 0.2 s |
| 81O / 81U frequency · 過／低頻 | 81O: > 62.0 Hz @ 2 s · 81U: < 57.5 Hz @ 10 s |

### How to drive it · 操作方式

- Run the plant to power and close the **generator breaker**. New gauges read **Reactive power** (~557 MVAR
  lag), **Terminal voltage** (24 kV), **Power factor** (0.90), **Grid frequency** (60.0 Hz), **Field current**
  (~1.0 pu). The schematic shows MVAR/PF/kV/Hz under the MWe readout and a `SYNCED` / synchroscope angle tag. ·
  升至功率並合上**發電機開關**；新增錶頭顯示無功（約 557 MVAR 滯後）、機端電壓（24 kV）、功率因數（0.90）、
  電網頻率（60.0 Hz）、勵磁電流（約 1.0 pu）；示意圖於 MWe 下方顯示 MVAR/PF/kV/Hz 及 `SYNCED`／同步角。
- Switch the **Excitation / AVR mode** combo and drag the voltage / PF / MVAR / manual-field sliders to move
  along the capability curve. Turn on the **Sync interlock** to require the 25 window before the breaker will
  close. **Gen protection armed** (default ON) plus a **Reset gen lockout (86)** button. · 切換**勵磁／AVR
  模式**並拖動電壓／功率因數／無功／手動勵磁滑桿沿能力曲線移動；開啟**同步聯鎖**後須滿足 25 窗口方可合閘；
  **發電機保護啟用**（預設開）連**重置發電機閉鎖（86）**按鈕。
- A loss-of-field, V/Hz, voltage or frequency excursion, or sustained motoring after a steam loss, trips the
  **86 lockout** → breaker open → turbine trip → (at power) anticipatory reactor trip. · 失磁、V/Hz、電壓或
  頻率越限，或失汽後持續電動化，會觸發 **86 閉鎖**→斷路器打開→汽輪機跳脫→（在功率時）預期反應堆跳脫。

### Safety / single-writer contract · 安全／單一寫入合約

Purely the electrical/turbine-trip path: `GeneratorTrip()` writes only `GeneratorBreakerClosed=false`, the trip
label, and calls the existing non-destructive `TripTurbine()`. No new code touches the meltdown-arm,
`Scram()`, or shutdown-countdown paths; the reactor scram that follows is the unchanged pre-existing
anticipatory permissive. · 純電氣／汽輪機跳脫路徑：`GeneratorTrip()` 只寫 `GeneratorBreakerClosed=false`、
跳脫標籤並呼叫既有非破壞性 `TripTurbine()`；不觸碰熔毀啟用、`Scram()` 或關機倒數路徑。

### Research · 研究

Multi-agent ultracode pass (3 parallel research agents → synthesis): synchronous-generator ratings &
capability curve (IEEE/ANSI C50.13), AVR/excitation & sync-check practice (IEEE 421.5 · ANSI 25), and
generator protective-relay setpoints/timers & unit-trip logic (IEEE C37.102 / C37.106), distilled into a
build-ready managed-C# spec matching the existing single-writer `UpdateSecondary` integrator.

### Screenshots · 截圖

Skipped this run — computer-use screenshot access cannot be granted in the unattended scheduled-run
environment. The change is verified by a clean `dotnet build` (0 errors). · 本次略過：無人值守排程環境無法授予
computer-use 截圖權限。改動已以乾淨建置（0 錯誤）驗證。

---

## 2026-06-25 — Loss-of-flow & RCP locked-rotor accidents (FSAR Ch 15.3.2 / 15.3.3 · SRP NUREG-0800 15.3) + rods-in-DNB figure of merit · 反應堆冷卻劑流量喪失及主泵卡軸事故（FSAR 15.3.2／15.3.3 · SRP NUREG-0800 15.3）連 DNB 燃料棒比例判據

**Commit:** [`0c67068`](https://github.com/codingmachineedge/WinForge/commit/0c67068) on `feature/reactor-hyper`.

### What it models · 模擬內容

A PWR's anti-DNB margin depends on keeping coolant moving past the fuel. FSAR Chapter 15.3 covers the
**decrease in reactor coolant flow** events. This run adds the two that bound them, built on the sim's
existing per-loop RCP **flywheel coastdown** and **W-3 minimum-DNBR** model:

- **Complete loss of forced flow (15.3.2)** — loss of power to all four RCP buses (undervoltage /
  underfrequency) trips every pump at once. They coast on flywheel inertia (a hyperbolic decay,
  `W/W₀ ≈ 1/(1 + t/τ)`) down to the ~3–5 % single-phase natural-circulation floor. The low-RCS-flow
  reactor trip (P-7 permissive) fires within ~1–2 s, so minimum DNBR stays **above** the 1.30 limit — a
  protected Condition II/III event, no fuel failure.
- **RCP rotor seizure / locked rotor (15.3.3)** — one pump's impeller **seizes instantaneously**: that
  loop's flow collapses to ~0 in a single tick with **no** flywheel coastdown, while the other three keep
  running. Core flow steps to ~¾ rated almost immediately — the **fastest** flow loss and therefore the
  **DNBR-limiting** Condition-IV event. The reactor trips on low flow, but local DNB is permitted on a
  limited fraction of rods.

A new **rods-in-DNB figure of merit** (`RodsInDnbPercent`) surfaces the locked-rotor acceptance basis: an
engineering surrogate of the hot-channel DNBR distribution, zero while min DNBR ≥ 1.30 and rising as it falls
below, checked against the **< ~5 %** rods-in-DNB criterion (rods in DNB are assumed failed for dose).

壓水堆抗 DNB 餘裕取決於維持冷卻劑流經燃料。FSAR 第 15.3 章涵蓋**反應堆冷卻劑流量下降**事故。本次加入兩個
最受限者，建基於模擬既有逐環主泵**飛輪惰轉**及 **W-3 最小 DNBR** 模型：**全喪失強制流量（15.3.2）**——四條
主泵母線同時失電（欠壓／欠頻），各泵靠飛輪慣性惰轉（雙曲衰減 `W/W₀ ≈ 1/(1+t/τ)`）降至約 3–5 % 單相自然循環
底值；低流量停堆（P-7 許可）於約 1–2 秒動作，最小 DNBR 保持**高於** 1.30，屬受保護事故、無燃料失效。
**主泵卡軸（15.3.3）**——單泵葉輪**瞬間卡死**，該環流量一步跌至約零、**無**飛輪惰轉，其餘三泵繼續運轉；堆芯
流量即時跌至約四分之三額定，係**最快**流量喪失，亦即 **DNBR 最受限**的第四類事故。新增 **DNB 燃料棒比例判據**
（`RodsInDnbPercent`，熱通道 DNBR 分佈之工程替代量）呈現卡軸接受準則，對應 **< 約 5 %** 燃料棒進入 DNB。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Flywheel coastdown (CLOF) · 飛輪惰轉（全失流量） | `W/W₀ ≈ 1/(1+t/τ)`: ~0.93@1s · ~0.70@5s · ~0.50@10s |
| Natural-circulation floor · 自然循環底值 | ~3–5 % rated |
| Locked-rotor core flow step · 卡軸堆芯流量 | → ~0.74–0.76 rated within ~1 tick |
| Low-RCS-flow reactor trip · 低流量停堆設定點 | ~90 % rated flow (P-7 permissive) |
| DNBR 95/95 safety limit (W-3) · DNBR 95/95 安全限值 | **1.30** |
| Locked-rotor rods-in-DNB acceptance · 卡軸 DNB 燃料棒接受準則 | **< ~5 %** (bounding 10 %) |
| Peak RCS pressure limit · 峰值 RCS 壓力限值 | ≤ 2750 psia (110 % design) |
| Peak clad temperature limit · 峰值包殼溫度限值 | < 2700 °F |
| Event timescale (min DNBR / peak P) · 事故時標 | ~3–5 s (analysis to ~10 s) |

### How to drive it · 操作方式

- Run the plant up to power, then pick **"Complete loss of flow (Ch 15.3.2)"** or **"RCP locked rotor
  (Ch 15.3.3)"** from the Scenario combo. · 升至功率後於情景選單揀「全喪失強制流量（15.3.2）」或「主泵卡軸
  （15.3.3）」。
- The **RCP flow** gauge tags the live flow mode (`LOCKED LOOP n` / `COASTDOWN` / `NAT CIRC`); the **Min
  DNBR** gauge appends the predicted **% rods in DNB** when it climbs off zero. New annunciators: **RCP
  LOCKED ROTOR (15.3.3)** and **RODS IN DNB > 5%**. · 主泵流量錶標示流量模式，最小 DNBR 錶於非零時附加預測
  DNB 燃料棒比例；新增「主泵卡軸」及「DNB 燃料棒 >5%」報警。
- Display/figure-of-merit only — no new trip and no meltdown-arm change; the existing low-flow trip + scram
  provide the protective response. · 純顯示／判據——無新增跳脫，亦不改熔毀解除預設，保護動作仍由既有低流量
  停堆與緊急停堆提供。

### Research · 研究

Multi-agent ultracode pass (3 parallel research agents → synthesis, 29 quantitative facts): FSAR 15.3
physics & trip setpoints, transient signatures & acceptance criteria, and a minimal managed-C# integration
approach reusing the existing flow/DNBR infrastructure.

### Screenshots · 截圖

Skipped this run — computer-use screenshot access cannot be granted in the unattended scheduled-run
environment. The change is verified by a clean `dotnet build` (0 errors). · 本次略過：無人值守排程環境無法授予
computer-use 截圖權限。改動已以乾淨建置（0 錯誤）驗證。

---

## 2026-06-25 — RCS Leakage Detection (LCO 3.4.13 operational LEAKAGE · RG 1.45 / LCO 3.4.15 detection instrumentation) · 反應堆冷卻劑系統洩漏偵測（LCO 3.4.13 運轉洩漏 · RG 1.45／LCO 3.4.15 偵測儀表）

**Commit:** [`e8ce87f`](https://github.com/codingmachineedge/WinForge/commit/e8ce87f) on `feature/reactor-hyper`.

### What it models · 模擬內容

Every PWR continuously polices how much reactor coolant is escaping the **reactor coolant pressure boundary**,
because a growing leak is the first warning of a degrading pressure boundary (a cracked weld, a failing valve
packing, a degraded RCP seal). Standard Tech Spec **LCO 3.4.13** splits "operational LEAKAGE" into three
categories with hard limits, and **RG 1.45 / LCO 3.4.15** requires **diverse** instruments able to detect a
**1 gpm unidentified leak within 1 hour**. This run adds an instrumentation-only model of all three: a
**containment normal-sump** level/flow channel (auto-pumped), and containment-atmosphere **particulate
(I-131)** and **gaseous (Xe-133) noble-gas** radiation monitors whose response scales with the **live RCS
specific-activity source term** (the existing DEI-131/Xe-133 model), plus the slow **SR 3.4.13.1 RCS water
inventory balance** estimate. Identified LEAKAGE is fed by the **degraded RCP-seal leakoff** above the normal
recovered #1-seal bleed-off, so a seal LOCA now lights the identified-leak LCO alarm too.

每座壓水堆都持續監察有幾多反應堆冷卻劑漏出**反應堆冷卻劑壓力邊界**，因為洩漏增長係壓力邊界劣化（焊縫裂、閥
填料失效、主泵軸封劣化）嘅最早警號。標準技術規格 **LCO 3.4.13** 將「運轉洩漏」分為三類並設硬性上限，而
**RG 1.45／LCO 3.4.15** 要求**多元**儀表能喺**一小時內偵測 1 gpm 未辨識洩漏**。本次加入三類嘅純儀表模型：
**安全殼集水坑**水位／流量通道（自動抽水），以及安全殼大氣**顆粒物（碘-131）**與**氣體（氙-133 惰性氣體）**
輻射監測——其響應按**實時冷卻劑比活度源項**（既有 DEI-131／Xe-133 模型）換算，連同緩慢嘅 **SR 3.4.13.1 冷卻
劑存量平衡**推算。已辨識洩漏由**劣化主泵軸封洩漏**（超出正常回收嘅一號軸封排放）驅動，故軸封失水亦會點亮已
辨識洩漏 LCO 警報。

### Key quantitative facts / setpoints · 關鍵量化事實／設定點

| Quantity · 量 | Value · 數值 |
|---|---|
| Unidentified LEAKAGE limit · 未辨識洩漏上限 | **1 gpm** (LCO 3.4.13.b) |
| Identified LEAKAGE limit · 已辨識洩漏上限 | **10 gpm** (LCO 3.4.13.c) |
| Pressure-boundary LEAKAGE · 壓力邊界洩漏 | **NONE allowed** (LCO 3.4.13.a) |
| RG 1.45 detection criterion · 偵測準則 | sense **1 gpm unidentified within 1 h** |
| Required-Action completion · 所需行動完成時間 | restore ≤ limit in **4 h**, else MODE 3 in **6 h** / MODE 5 in **36 h**; pressure-boundary = no restore time |
| SR 3.4.13.1 inventory balance · 存量平衡監測 | **72 h** frequency (modelled as a 10-min filter) |
| Sump channel filter τ · 集水坑濾波時間常數 | 120 s → settles to true leak in ~6–10 min (≪ 1 h window) |
| Particulate monitor calibration · 顆粒物監測校準 | ratio 1.0 at ~0.1 gpm of nominal-activity coolant (0.05 µCi/g) |
| Sump pump start/stop · 集水坑泵起停 | 1000 gal / 200 gal hysteresis, 50 gpm pump-down |

**Detection physics:** the unidentified leak fills the sump at `gpm·dt/60` gal; the **RG 1.45 sump channel**
infers the rate from the level-rise rate through a 120 s first-order filter *before* the pump strokes (so a
pump-down cycle never reads as a negative leak). The **particulate** monitor reads
`200 · gpm · DEI-131(µCi/g)` and the **gaseous** monitor `0.5 · gpm · Xe-133(µCi/g)` — both diverge from the
sump channel only through the **live coolant activity**, exactly the RG 1.45 diversity argument. Every dynamic
state uses a clamped first-order relaxation `x += (target−x)·min(1, dt/τ)`, unconditionally stable for any `dt`.

**偵測物理：** 未辨識洩漏以 `gpm·dt/60` 加侖填充集水坑；**RG 1.45 集水坑通道**喺泵動作*之前*透過 120 秒一階
濾波由水位上升率推算洩漏率（故抽水循環唔會被誤讀為負洩漏）。**顆粒物**監測讀數為 `200·gpm·DEI-131(µCi/g)`，
**氣體**監測為 `0.5·gpm·Xe-133(µCi/g)`——兩者僅透過**實時冷卻劑活度**與集水坑通道分歧，正正係 RG 1.45 嘅多元論
據。所有動態狀態採用受限一階弛豫 `x += (target−x)·min(1, dt/τ)`，任何 `dt` 均無條件穩定。

### How to drive it · 操作方式

In the reactor control panel, under **RCS pressure boundary · 一次側壓力邊界**: drag the **Unidentified leak —
demo (gpm)** slider above **1.0 gpm** to trip `UNID LEAK > 1 GPM` and both atmosphere rad monitors; toggle
**Pressure-boundary leak** to assert the never-allowed `PRESS BDY LEAKAGE` alarm. Both default OFF — the whole
subsystem reads zero and raises no alarm at startup. Watch the **Containment sump**, **Particulate monitor** and
**Gaseous monitor** gauges respond, and the sump auto-pump cycle at 1000 gal.

新增控制位於反應堆控制面板**一次側壓力邊界**：將**未辨識洩漏－示範（gpm）**滑桿拉過 **1.0 gpm** 即觸發
`未辨識洩漏 >1 GPM` 連兩個大氣輻射監測；開啟**壓力邊界洩漏**會宣告永不容許嘅 `壓力邊界洩漏` 警報。兩者預設關
閉——啟動時整個子系統讀零、不報警。可觀察**安全殼集水坑**、**顆粒物輻射監測**、**氣體輻射監測**儀表響應，以及
集水坑於 1000 加侖自動抽水循環。

---

## 2026-06-25 — Post-LOCA boric-acid precipitation + hot-leg recirculation switchover (10 CFR 50.46(b)(5) long-term core cooling · Westinghouse ERG ES-1.4) · LOCA 後硼酸析出連熱段再循環切換（10 CFR 50.46(b)(5) 長期堆芯冷卻 · 西屋 ERG ES-1.4）

**Commit:** [`a24c6d7`](https://github.com/codingmachineedge/WinForge/commit/a24c6d7) on `feature/reactor-hyper`.

### What it models · 模擬內容

After a **loss-of-coolant accident**, the emergency core cooling system injects **highly borated** water
(RWST, then the containment sump) to keep the core covered. Decay heat **boils that water off** in the core,
but boric acid is **non-volatile** — it stays behind and **concentrates** in the core mixing region. If the
local concentration reaches the **temperature-dependent solubility limit**, boric acid **precipitates** onto
the fuel, plugging flow channels and defeating long-term cooling. This is the **10 CFR 50.46(b)(5)** long-term
cooling concern (→ GDC 35 → NUREG-0800 SRP 6.3 → each plant's boric-acid-precipitation analysis). The operator
prevents it by transferring to **hot-leg recirculation** (Westinghouse Emergency Response Guideline **ES-1.4**),
establishing a through-core **flushing flow** that sweeps the concentrated borate out the hot legs.

This run adds a physically-faithful **instrumentation-only** model of that concentration build-up, the moving
solubility limit, the operator hot-leg-recirc action, and the **time-to-precipitation** operator-action window.

失水事故（LOCA）之後，應急堆芯冷卻系統注入**高硼**水（先換料水箱，後安全殼集水坑）以保持堆芯淹沒。衰變熱在
堆芯**將水蒸發**，但硼酸**不揮發**——留低並在堆芯混合區**濃縮**。若局部濃度達到**隨溫度變化嘅溶解度極限**，
硼酸會在燃料上**析出結晶**，阻塞流道、令長期冷卻失效。此即 **10 CFR 50.46(b)(5)** 長期冷卻問題（→ GDC 35 →
SRP 6.3 → 各廠硼酸析出分析）。操作員以切換至**熱段再循環**（西屋 ERG **ES-1.4**）防止之，建立穿堆**沖洗流**
將濃縮硼酸由熱段沖走。本次新增該濃縮過程、移動溶解度極限、操作員熱段再循環行動，以及**距析出時間**操作裕度，
為純儀表（不接後果路徑）模型。

### Key quantitative facts / setpoints · 關鍵量化事實／設定點

| Quantity · 量 | Value · 數值 |
|---|---|
| H₃BO₃ solubility @ 25 °C / ~100 °C · 硼酸溶解度 | ~50 g/L → ~275 g/L (steep, −ΔH of solution) |
| Solubility limit `Cs` @ 100 °C · 溶解度極限 | ~275 g/L H₃BO₃ ≈ **48,000 ppm B** (NURETH-16) |
| B mass fraction of H₃BO₃ · 硼質量分數 | 0.175 (10.81/61.83) |
| ECCS injection boron (RWST) · 注入硼濃度 | ~2,300–2,700 ppm B → core must concentrate **~20×** |
| Decay-heat boil-off @ 1 h · 1 小時衰變熱蒸發 | ~22 kg/s (~360 gpm); DH ~1.5 % RTP |
| Time-to-precip w/o flush · 無沖洗距析出 | "a few hours" (set by core mixing volume ~10 m³) |
| Hot-leg switchover (HLSO) credited time · 熱段切換認可時間 | typ. **~5.5 h** (W generic ~7 h; Watts Bar ~3 h) |
| EOP step · 應急程序步驟 | Westinghouse ERG **ES-1.4** "Transfer to Hot Leg Recirculation" (ES-1.3 = cold leg) |

**Concentration physics (closed-form, unconditionally stable):** the core-mixing-region concentration relaxes
toward a quasi-steady ceiling by the exact exponential solution `C ← target + (C − target)·exp(−k_net·dt)` each
tick — never overshoots or diverges at any timestep (the same single-writer discipline as the dilution model).
Boil-off drives `k_conc = (BoiloffDeficitRate·DecayHeatFraction)/100` (1/s); a baseline core↔RCS turnover floor
`CoreMixFloor = 1/600 s` caps concentration even without recirc; hot-leg recirc adds a `1/300 s` flush that
collapses the ceiling to the injection concentration.

**Temperature-dependent solubility limit** (linear-in-T fit to the handbook curve, B-ppm basis):

```
Cs(T) = max( 20000 , [50 + 3·(clamp(T,25,150) − 25)] · 0.175 · 1000 )  ppm B
      → Cs(100 °C) = 275 g/L · 0.175 · 1000 = 48,125 ppm B
```

**Closed-form time-to-precipitation** from the same exp law (direct analog of the dilution time-to-criticality):

```
t_precip = −(1/k_net)·ln( (target − Cs) / (target − C) )
```

returning +∞ when the quasi-steady ceiling sits below `Cs` (recirc winning, or never precipitates) and 0 once
already at the limit. New **Core boron (precip)** and **Time to precip** gauges show the concentration against
the moving `Cs` marker and the hours-to-precipitation window; a `BORIC ACID PRECIP — GO ES-1.4` action alarm
and a latched `BORIC ACID PRECIPITATED` alarm annunciate the event.

### New operator action · 新增操作員動作

- **Safety injection ▸ ES-1.4 hot-leg recirc · 熱段再循環** — a toggle (default **OFF**) that elects the
  hot-leg-recirculation transfer. With it on, the concentration ceiling collapses to the injection
  concentration and core boron flushes down with a ~5-min e-fold, holding below `Cs`. The model is gated to a
  genuine LOCA long-term-cooling state only — an actual break (or latched inventory deficit past the uncovery
  reserve) **with** borated injection actually feeding the core (SI actuated / ECCS injecting), the core at/near
  **saturation**, and meaningful decay heat — so normal operation, ordinary trips and still-subcooled transients
  never trigger it.

### Single-writer / safety contract · 單一寫入／安全合約

`StepBoricAcidPrecip` mirrors the `StepRvlis` / `StepCet` instrumentation contract: it reads post-tick state and
writes **only** its own readouts and two advisory alarms — never `FuelTemp`, `PrimaryDeficitPct` or
`MeltdownTriggered`. There is **no consequence path**, so the meltdown-ARM and ECCS logic are provably
unaffected; the precipitation indication stays live even through a meltdown for diagnostic value. ·
`StepBoricAcidPrecip` 仿 `StepRvlis`／`StepCet` 儀表合約：只讀後態、只寫自身讀數同兩個告警，絕不寫
`FuelTemp`、缺水或熔毀旗標，無後果路徑，故熔毀武裝與 ECCS 邏輯不受影響。

### Screenshots · 截圖

Skipped this run — the scheduled, unattended environment cannot be granted interactive desktop / computer-use
access to launch the WinUI app and capture the reactor panel. The change is verified by a clean `dotnet build`
(0 errors). · 本次略過：排程無人值守環境無法取得互動桌面／computer-use 權限以啟動 WinUI 程式截取反應堆面板。
改動已以乾淨建置（0 錯誤）驗證。

---

## 2026-06-25 — Uncontrolled boron dilution accident (FSAR Ch 15.4.6 · SRP 15.4.6) — exponential CVCS dilution → time-to-criticality + 15-min operator-action window · 失控硼稀釋事故（FSAR 15.4.6 · SRP 15.4.6）——CVCS 指數稀釋連距臨界時間及15分鐘操作裕度

**Commit:** [`79166df`](https://github.com/codingmachineedge/WinForge/commit/79166df) on `feature/reactor-hyper`.

### What it models · 模擬內容

An **uncontrolled boron dilution** is an ANS **Condition II** event (a fault of moderate frequency) and a
classic licensing-basis transient in **FSAR Chapter 15.4.6**. A failure in the Chemical & Volume Control
System (CVCS) makeup path — e.g. the makeup controller stuck in DILUTE with a failed-open reactor-makeup-water
(RMW) valve — pumps **unborated** water into the reactor coolant. Because soluble boron is a strong negative
reactivity poison, washing it out **adds positive reactivity**, eroding shutdown margin and driving the core
toward an unwanted criticality.

Until this run, boron was a simple linear ramp toward a target setpoint. This entry adds a physically-faithful
**well-mixed dilution model** and the full licensing figure of merit: the **operator-action time window**.

失控硼稀釋屬 ANS **第二類**（中頻率）事件，是 **FSAR 第 15.4.6 章** 的經典持照基準暫態。化學及容積控制系統
（CVCS）補水路徑故障（例如補水控制器卡於稀釋檔、補水閥失效開啟）將**無硼**水泵入反應堆冷卻劑。由於可溶硼是
強負反應性毒物，把硼沖走會**加入正反應性**，侵蝕停堆裕度，令堆芯趨向非預期臨界。本次以貼近物理的**混合稀釋
模型**取代原本的線性硼斜坡，並加入完整持照判據——**操作員行動時間裕度**。

### Key quantitative facts / setpoints · 關鍵量化事實／設定點

| Quantity · 量 | Value · 數值 |
|---|---|
| RCS active mixing volume `V` · 一迴路有效混合體積 | 80,000 US gal (≈ 303 m³) |
| Max unborated RMW dilution flow `Q` · 最大無硼補水稀釋流量 | 150 gpm (single charging pump) |
| Dilution time constant `τ = V/Q` · 稀釋時常數 | ≈ 533 min (≈ 8.9 hr) |
| Differential boron worth `α_B` · 微分硼價 | −9.5 pcm/ppm (reuses `BoronWorth = −9.5e-6`) |
| Tech-Spec minimum shutdown margin · 技術規範最小停堆裕度 | 1300 pcm (1.3 % Δk/k) |
| Operator-action criterion (Modes 1–5) · 操作員行動準則（模式1-5） | ≥ **15 min** alarm → loss of SDM |
| Operator-action criterion (Mode 6, refueling) · （模式6 換料） | ≥ **30 min** |
| Credited detection · 認可偵測 | Source-range count-rate **doubling** while subcritical |

**Dilution physics (exact, unconditionally stable):** boron obeys `dC/dt = −(Q/V)·C`, integrated by the
closed-form solution `C ← C·exp(−(Q/V)·dt)` each tick — so it is stable for any timestep and is the *single
writer* of `BoronPpm` during the event (the normal ±4 ppm/s charging ramp is gated off).

**Closed-form time-to-criticality** from the **live** total reactivity margin `ρ_now` (so Doppler, MTC and
xenon feedback fold in automatically):

```
t_crit = −(1/k)·ln( 1 + ρ_now / (−α_B · C) ) ,   k = (Q/V)
```

returning +∞ when the remaining boron inventory can never reach criticality, and 0 once already critical. A
new **Dilution window** gauge shows minutes-to-criticality with 15-min (danger) / 30-min (warn) bands, and a
`BORON DILUTION` source-range alarm plus a `DILUTION < 15-MIN WINDOW` action-window alarm annunciate the event.

### New operator scenario · 新增操作員情景

- **Scenario ▸ Boron dilution (Ch 15.4.6) · 失控硼稀釋（15.4.6）** — injects unborated RMW at 150 gpm; watch
  the Boron gauge fall, the source-range flux climb, and the Dilution-window gauge count down. Recover by
  selecting **Normal** (isolates the dilution) and re-borating toward the target via the boron slider.

### Screenshots · 截圖

Skipped this run — the scheduled, unattended environment cannot be granted interactive desktop / computer-use
access to launch the WinUI app and capture the reactor panel. The change is verified by a clean `dotnet build`
(0 errors). · 本次略過：排程無人值守環境無法取得互動桌面／computer-use 權限以啟動 WinUI 程式截取反應堆面板。
改動已以乾淨建置（0 錯誤）驗證。

---

## 2026-06-25 — RCS coolant radiochemistry source term — Dose-Equivalent I-131 / Xe-133 + concurrent iodine spike (Tech Spec LCO 3.4.16 · ANSI/ANS-18.1 · RG 1.183) · 反應堆冷卻劑放射化學源項——碘-131／氙-133劑量當量比活度連同步碘尖峰（技術規範 LCO 3.4.16 · ANSI/ANS-18.1 · RG 1.183）

**Commit:** [`719ff4f`](https://github.com/codingmachineedge/WinForge/commit/719ff4f) on `feature/reactor-hyper`.

### What it models · 模擬內容

Until now the reactor coolant's radioactivity was a single crude scalar (`CoolantActivity = 0.02 + …`) that only
existed to give a steam-generator-tube-rupture a number to leak. This run replaces it with a **real radiochemical
source term**: the actual fission-product activity dissolved in the reactor coolant, tracked as concentration in
**µCi/g** and governed by genuine first-order balance equations.

A new `StepRadiochemistry()` carries **five iodine isotopes** (I-131…I-135) and **two noble-gas groups**
(Xe-133, Xe-135) as independent activity states, each obeying

```
A ← A + ( S·defect·spike − (λ_decay + k_removal)·A )·dt
```

where `S` is the gap-to-coolant **appearance rate**, `λ_decay = ln2/T½` the radioactive decay, and `k_removal` the
**letdown/purification** (iodine, ~1/35 h) or **degasifier** (noble gas, ~1/7 h) cleanup. A single **fuel-defect
multiplier**, driven by the core's accumulated damage, scales every source term from a clean intact-fuel baseline up
to the **design-basis 1 % failed-fuel** condition — so one knob moves the whole source term, exactly as ANSI/ANS-18.1
treats it.

The headline output is **Dose-Equivalent I-131 (DEI-131)** — each iodine isotope weighted by its thyroid committed-dose
factor and summed — directly comparable to the **Tech Spec LCO 3.4.16** limits. A companion **Dose-Equivalent Xe-133**
rolls up the noble gases.

**Iodine spiking** (the licensing phenomenon): on a **reactor-trip rising edge** *or* a **rapid RCS depressurization**
(|dP/dt| > 0.10 MPa/s), the iodine appearance rate is multiplied by a **spike factor** sustained for **8 hours** —
**335×** for a generic trip / SGTR (RG 1.183 App. E) and **500×** for a main-steam-line break (App. F). DEI-131 then
climbs sharply (toward tens of µCi/g, tripping the 60 µCi/g alarm) and **decays back toward equilibrium on its own**
through the same decay+removal terms once the timer expires — short-lived I-132/I-134 dominate the spike's shape.

The DEI-131 value (normalized so **1.0 = the LCO limit**) now feeds the **existing** SGTR/MSLB secondary-side transport,
so a steam-generator-tube-rupture's secondary radiation and atmospheric release now scale with the **real** coolant
activity — a *spiked, fuel-damaged* SGTR is radiologically far worse than a clean one, emergently, with no extra script.

Two **radiation monitors** were added: a **main-steam-line N-16 monitor** (N-16 is bred in-core, 7.13 s half-life,
6.13 MeV γ — power-proportional and near-instant, the real plant's fastest primary-to-secondary leak detector) and a
**CVCS letdown / process monitor** tracking total RCS specific activity.

至今反應堆冷卻劑的放射性只係一個粗略標量（`CoolantActivity = 0.02 + …`），純粹為蒸發器爆管提供一個洩漏數值。
本次以**真正放射化學源項**取代之：冷卻劑中實際溶解的裂變產物活度，以 **µCi/g** 比活度追蹤，並由真正的一階平衡方程
支配。新 `StepRadiochemistry()` 將**五種碘同位素**（I-131 至 I-135）連**兩組惰性氣體**（Xe-133、Xe-135）作為獨立活度
狀態演進，每個服從 `A ← A + (S·破損·尖峰 − (λ衰變 + k去除)·A)·dt`，其中 `S` 為包殼間隙至冷卻劑的**釋出率**，`λ衰變`
為放射衰變，`k去除` 為**淨化排水**（碘，約 1/35 小時）或**除氣器**（惰性氣體，約 1/7 小時）淨化。單一**燃料破損
係數**（由爐心累積損傷驅動）把所有源項由清潔完整燃料基線縮放至**設計基準 1% 破損燃料**——一個旋鈕帶動整個源項，
正如 ANSI/ANS-18.1 處理方式。主要輸出為**碘-131 劑量當量（DEI-131）**：各碘同位素按其甲狀腺待積劑量因子加權求和，
可直接對比 **技術規範 LCO 3.4.16** 限值；另有**氙-133 劑量當量**統合惰性氣體。**碘尖峰**（執照分析現象）：反應堆
跳脫上升沿**或**一迴路快速洩壓（|dP/dt| > 0.10 MPa/s）時，碘釋出率乘以**尖峰係數**並維持 **8 小時**——一般跳脫／
SGTR 為 **335 倍**（RG 1.183 附錄 E），主蒸汽管爆裂為 **500 倍**（附錄 F）。DEI-131 隨即急升（至數十 µCi/g，觸發
60 µCi/g 警報），計時器到期後憑同一衰變＋去除項**自行衰減回平衡**；短壽命 I-132／I-134 主導尖峰形狀。DEI-131
（歸一化為 **1.0 = LCO 限值**）現驅動**既有** SGTR／MSLB 二次側輸送，故爆管的二次側輻射同大氣排放隨**真實**冷卻劑
活度變化——*已尖峰、燃料受損*的 SGTR 在放射上遠比清潔者嚴重，且係湧現、無需額外腳本。另新增兩個**輻射監測**：
**主蒸汽管 N-16 監測**（N-16 於堆芯生成、半衰期 7.13 秒、6.13 MeV γ，與功率成正比且近乎即時，為真實機組最快的
一二次側洩漏偵測）連 **CVCS 淨化排水／製程監測**，追蹤一次側總比活度。

### Key quantitative facts · 關鍵量化資料

| Quantity 量 | Value 數值 | Source 來源 |
|---|---|---|
| DEI-131 steady-state limit 穩態限值 | **1.0 µCi/g** | STS LCO 3.4.16 (NUREG-1431) |
| DEI-131 transient / spike limit 暫態尖峰限值 | **60 µCi/g** | STS LCO 3.4.16 |
| Dose-Equiv Xe-133 noble-gas limit 氙當量限值 | **280 µCi/g** | STS LCO 3.4.16 |
| Clean intact-fuel DEI-131 清潔完整燃料 | **~0.07 µCi/g** (≈14× below LCO) | typical / ANS-18.1 |
| Failed-fuel design basis 破損燃料設計基準 | **1 %** rods | source-term/dose convention |
| SGTR / generic-trip spike factor 尖峰係數 | **335×**, 8 h | RG 1.183 App. E |
| MSLB spike factor 主蒸汽管爆裂尖峰係數 | **500×**, 8 h | RG 1.183 App. F |
| I-131 / I-132 / I-133 / I-134 / I-135 half-lives 半衰期 | 8.02 d / 2.30 h / 20.8 h / 52.5 min / 6.57 h | nuclear data |
| Xe-133 / Xe-135 half-lives 半衰期 | 5.24 d / 9.14 h | nuclear data |
| N-16 half-life / γ energy 半衰期／γ能量 | 7.13 s / 6.13 MeV | O-16(n,p)N-16 |
| Iodine purification / noble-gas degas removal 去除常數 | ~1/35 h / ~1/7 h | letdown + degasifier |

### How it stays benign · 維持良性

The activity states are **seeded at their analytic clean-fuel equilibrium** `A_eq = S/(λ+k)` on construction and on
reset, so the plant launches already at steady state — DEI-131 ≈ 0.07 µCi/g, Xe-133 ≈ 30 µCi/g, **no cold-start
transient and no spurious alarm**. The model is purely additive; nothing trips until a real trip, depressurization, or
fuel-damage event drives the chemistry. New alarms: **DEI-131 > 1.0** (LCO), **DEI-131 > 60** (spike), **DEX-133 > 280**
(noble gas), and **iodine-spike-in-progress**. Four new gauges expose DEI-131, DEX-133, the N-16 monitor and the
letdown monitor; all strings are bilingual (EN + 繁體中文／粵語). No bundled assets — pure managed C#.

各活度狀態於建構及重設時以解析清潔平衡 `A_eq = S/(λ+k)` **播種**，故機組啟動即處穩態：DEI-131 約 0.07 µCi/g、
Xe-133 約 30 µCi/g，**無冷啟暫態、無誤報**。模型純屬加性；直至真實跳脫、洩壓或燃料損傷事件方驅動化學變化。新警報：
**DEI-131 > 1.0**（LCO）、**DEI-131 > 60**（尖峰）、**DEX-133 > 280**（惰性氣體）連**碘尖峰進行中**。四個新儀表顯示
DEI-131、DEX-133、N-16 監測同淨化排水監測；所有字串雙語（英文＋繁體中文／粵語）。無捆綁資產——純託管 C#。

---

## 2026-06-25 — Rod Ejection Accident (RIA / REA, FSAR Ch 15.4.8) — super-prompt-critical excursion, prompt-Doppler self-limiting, peak fuel-enthalpy figure of merit · 彈棒事故（RIA／REA，FSAR 15.4.8）——超瞬發臨界功率脈衝、瞬發都卜勒自限、峰值燃料焓判據

**Commit:** [`b5e771c`](https://github.com/codingmachineedge/WinForge/commit/b5e771c) on `feature/reactor-hyper`.

### What it models · 模擬內容

The sim already had a **dropped-rod** event (negative reactivity, a depressed quadrant, QPTR/LCO 3.2.4) and a
power-range **positive-rate** trip nominally "for rod ejection," but the **Rod Ejection Accident itself** — the
limiting reactivity-insertion accident of FSAR **Chapter 15.4.8** — was never simulated. This run adds it.

A new **"Rod ejection — RIA"** scenario models a **CRDM (control-rod drive mechanism) housing failure**: full RCS
pressure (~2250 psia) expels one **RCCA + drive shaft** clear of the core in **~0.1 s**. The ejected rod's worth is
inserted as a positive reactivity ramp over that ejection time. Worth is **power-dependent** — the bounding case is
**hot zero power (HZP)**, where the ejected rod sits deepest (highest worth) and Doppler feedback is weakest:

- **HZP ≈ 750 pcm** ejected worth — this exceeds β_eff (≈ 650 pcm), so the core goes **super-prompt-critical** (~1.15 $).
- **HFP ≈ 225 pcm** (≈ 0.35 $) — stays sub-prompt-critical, a mild bump.

The resulting **~45 ms power pulse is turned over by prompt Doppler, NOT by the scram** (the trip is orders of
magnitude too slow on this timescale). The plant's existing **lumped fuel-temperature** Doppler node has a ~5.5 s
thermal time constant and physically **cannot quench a 45 ms pulse**, so this run adds a dedicated **hot-pellet
enthalpy node** (adiabatic on the pulse timescale) and feeds a **prompt Doppler term** = `DopplerCoeff × (T_pellet −
slow baseline)` that is **zero in steady state** and only bites during the excursion. The pulse self-limits exactly
when enough enthalpy is deposited to Doppler-quench it. To resolve the stiff prompt mode the kinetics are
**sub-stepped at 1 ms** while the pulse is energetic, and reduce to the **exact prior 50 Hz path** outside an RIA.

The figure of merit is the **peak radial-average fuel enthalpy (cal/g)**, the quantity RIA acceptance is judged on.
It is tracked via a **Fink (2000) UO₂ enthalpy correlation** and compared against the regulatory limits, with two
cladding-failure modes evaluated: **PCMI** (enthalpy-rise threshold, dominant from a low-power start, burnup-dependent)
and **DNB** (assumed failure at power, preserving the RG 1.77 "DNB = failure" presumption).

本次新增 FSAR **15.4.8** 章的**彈棒事故**——壓水堆的限制性反應性引入事故。原模擬只有**落棒**事件（負反應性、
象限功率下陷、QPTR）同一個名義上「為彈棒而設」的功率變化率跳脫，但**彈棒事故本身**從未模擬。新「**彈棒 —
RIA**」情景模擬**控制棒驅動機構殼體破裂**：全反應堆冷卻劑壓力（約 2250 psia）於 **~0.1 秒**內把一支**控制棒組件＋
驅動軸**彈出堆芯，期間以正反應性斜坡插入棒價。棒價**隨功率而變**——包絡工況為**熱零功率**：彈出棒插得最深
（棒價最高）而都卜勒反饋最弱。熱零功率約 **750 pcm**（超過 β_eff ≈ 650 pcm，故堆芯**超瞬發臨界**，約 1.15 $）；
滿功率約 **225 pcm**（約 0.35 $，僅輕微擾動）。約 **45 毫秒**的功率脈衝由**瞬發都卜勒**撲熄，而非緊急停堆。
原有**集總燃料溫度**都卜勒節點時常數約 5.5 秒，物理上**無法淬熄 45 毫秒脈衝**，故本次新增專用**熱芯塊焓節點**
（脈衝時段視為絕熱），並引入**瞬發都卜勒項** = `DopplerCoeff × (芯塊溫 − 慢基線)`，穩態為零、僅在暫態起作用。
為解算剛性瞬發模態，脈衝活躍期間動力學以 **1 毫秒**內步長細分，非 RIA 時完全回退原 50 Hz 路徑。判據為**峰值
徑向平均燃料焓（cal/g）**，以 **Fink（2000）UO₂ 焓關聯式**追蹤並比對法規限值，同時評估兩種包殼失效模式：
**PCMI**（焓增量門檻，低功率起始為主，隨燃耗變化）同**DNB**（在功率時假定失效，沿用 RG 1.77「DNB = 失效」）。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| HZP ejected-rod worth (bounding) · 熱零功率彈棒棒價（包絡） | ~750 pcm (~0.75 %Δk/k, ~1.15 $) |
| HFP ejected-rod worth · 滿功率彈棒棒價 | ~225 pcm (~0.20 %Δk/k, ~0.35 $) |
| Mechanical ejection time · 機械彈出時間 | 0.10 s (linear worth ramp) |
| β_eff (BOL) / prompt-critical · 有效緩發份額／瞬發臨界 | 0.0065 / ρ = β = 1 $ |
| HZP power-pulse FWHM · 熱零功率脈衝半高寬 | ~45 ms (Doppler-terminated) |
| Coolability / no-melt limit (RG 1.236, 2021) · 可冷卻性／不熔限值 | **230 cal/g** peak radial-avg fuel enthalpy |
| Legacy coolability limit (RG 1.77, 1974) · 舊版可冷卻性限值 | **280 cal/g** (fresh-fuel / incipient melt) |
| PCMI clad-failure enthalpy RISE · PCMI 包殼失效焓增量 | ~150 cal/g (fresh) → ~60 cal/g (≈68 GWd/MTU) |
| At-power clad-failure criterion · 在功率包殼失效準則 | DNB (MinDNBR < 1.30, W-3 95/95) |
| UO₂ enthalpy fit (Fink 2000) · UO₂ 焓擬合 | H[cal/g] = 0.20262·T + 5.3665e-5·T² (T °C) |
| Core-avg specific power / F_Q · 堆芯平均比功率／F_Q | 38 W/g UO₂ / 2.5 → hot-pellet ~95 W/g |
| Hot-pellet thermal time constant · 熱芯塊熱時常數 | 5.5 s |
| Unit conversion · 單位換算 | 1 cal/g = 4.1868 J/g (230 = 963 J/g, 280 = 1172 J/g) |

### New operator controls / instrumentation · 新增操作員控制／儀表

- **"Rod ejection — RIA (Ch 15.4.8)"** scenario in the accident selector · 事故選單新增「彈棒事故 — RIA」情景。
- **"Peak fuel enthalpy"** gauge (0–300 cal/g) showing the absolute peak, the enthalpy **rise (Δ)**, the live
  ejected-rod worth during the event, and a `MELT / COOLABILITY / CLAD FAIL` state tag · 新增「峰值燃料焓」儀表
  （0–300 cal/g），顯示絕對峰值、焓**增量（Δ）**、事件期間即時棒價及狀態標籤。
- Three annunciators: **ROD EJECTION (RIA)**, **FUEL ENTHALPY > 230 cal/g**, **RIA FUEL FAILURE** · 三個報警。
- The ejected-rod reactivity is folded into the **rod reactivity** display line; the prompt Doppler into the
  **Doppler** line · 彈棒反應性併入棒反應性顯示，瞬發都卜勒併入都卜勒線。

### Design notes · 設計註記

The change is **equilibrium-neutral**: the prompt-Doppler term and the 1 ms sub-stepping are gated on the RIA
event being active, so normal-operation kinetics, thermal-hydraulics and every prior scenario reduce to the exact
pre-existing code path. No bundled assets; all bilingual via the existing `Loc.I.Pick` pattern. The
meltdown→real-shutdown ARM remains **OFF** by default and is untouched by this feature.

本改動**保持平衡態不變**：瞬發都卜勒項與 1 毫秒細分均以 RIA 事件啟動為條件，正常運行動力學、熱工水力及所有
原有情景都完全回退至既有程式路徑。無外掛資產，全部以既有 `Loc.I.Pick` 雙語化。熔毀→真實關機 ARM 仍預設**關閉**
且不受本功能影響。

### Research · 研究

Quantitative facts assembled by a focused **ultracode** multi-agent research pass (3 parallel researchers —
kinetics/ejected-rod worths, RIA acceptance limits, UO₂ enthalpy + managed-C# approach — then a synthesis),
citing NRC **RG 1.77** (ML003740279), **RG 1.236** (ML20055F490), **NUREG-0800 SRP 4.2**, NRC **W-6382**
(ML020430129), **NUREG/IA-0215**, and **Fink, J. Nucl. Mater. 279 (2000)**.

### Screenshots · 截圖

Skipped this run — in the scheduled-run environment computer-use screenshot access cannot be granted, and the app
currently trips a known cold-core supercritical fault on launch, so the reactor panel could not be captured cleanly.
The change is verified by a clean `dotnet build` (0 errors). · 本次略過：排程環境無法取得 computer-use 截圖權限，
且程式現有已知「冷堆芯超臨界」啟動故障，無法乾淨擷取面板。改動已以乾淨建置（0 錯誤）驗證。

---

## 2026-06-25 — Containment hydrogen combustion control (10 CFR 50.44) — PARs, glow-plug igniters, AICC deflagration · 安全殼可燃氣體控制（10 CFR 50.44）——被動複合器、輝光點火器、AICC 爆燃

**Commit:** [`f13f46c`](https://github.com/codingmachineedge/WinForge/commit/f13f46c) on `feature/reactor-hyper`.

### What it models · 模擬內容

The cladding model already generated **hydrogen mass** from the high-temperature **Zr + 2H₂O → ZrO₂ + 2H₂**
oxidation (full-core ≈ **1141 kg**), but that H₂ vanished into a number. This run gives it somewhere to go: the
**containment atmosphere**. The cumulative airborne H₂ is converted to a **volume-percent concentration** against
the live atmosphere mole count (PV = nRT over the **73,624 m³ / 2.6×10⁶ ft³** large-dry free volume), using the
*additive-mole* form `vol% = 100·n_H₂ / (n_atm + n_H₂)` — correct for a sealed fixed-volume building and bounded
below 100 %. The full-core 1141 kg release reads **≈ 15 vol%**, deep in the detonable regime, matching reality.

Two real mitigation paths act on it, per **10 CFR 50.44 "Combustible gas control"**:

- **Passive Auto-catalytic Recombiners (PARs)** — always passive, no control. A **50-unit AREVA FR380-class**
  bank, each removing **≈ 5 kg H₂/hr at 4 vol%**, modelled **first-order in H₂ concentration and ∝ pressure**,
  starting at the **~1 vol%** catalytic onset and **O₂-limited** under starvation. The bank trickles hundreds of
  kg out over hours.
- **Distributed Ignition System (glow-plug igniters)** — **operator-armed, default OFF**. When armed *and*
  powered (de-energized in a station blackout), the **~930 °C / 1700 °F** glow plugs deliberately burn H₂ down to
  the **4.1 vol% lean limit** so it never reaches detonable concentrations. Arming **late, above ~13 vol%**, lights
  it in the detonable band → **DDT/detonation** (doubled spike), the realistic late-actuation hazard.

A **spontaneous deflagration** fires when a flammable, all-direction-propagating mixture (**≥ 9 vol%**) finds an
ignition source, burning the whole airborne inventory in one shot and depositing a **one-shot AICC pressure +
temperature spike** that the existing containment relaxation (passive sinks / fan coolers / spray) then bleeds
down — the sharp-rise/minutes-decay shape of the **TMI-2** burn. A **steam-inerting** proxy (a hot, pressurized
building is steam-rich) suppresses combustion during the blowdown phase and only lets it burn once sprays/fans
condense the steam back down — exactly the TMI-2 sequencing (burn ≈ 10 h in). Every term is **zero with no H₂
present**, so normal operation is provably unaffected.

包殼模型本已由高溫 **Zr + 2H₂O → ZrO₂ + 2H₂** 氧化產生**氫氣質量**（全堆芯約 **1141 kg**），但氫氣只係一個
數字。今次畀佢一個去處：**安全殼大氣**。累積飄散氫氣按即時大氣莫耳數換算成**體積百分比**（PV=nRT，**73,624
立方米／2.6×10⁶ 立方呎**大型乾式自由容積），用*疊加莫耳*式 `體積% = 100·n_H₂ / (n_atm + n_H₂)`——適用於密封
定容安全殼，且恆小於 100%。全堆芯 1141 kg 釋放讀數**約 15%**，深入可爆炸範圍，符合現實。

按 **10 CFR 50.44「可燃氣體控制」**，兩條真實緩解路徑作用其上：

- **被動自催化複合器（PARs）**——長期被動、無操作。**50 台 AREVA FR380 級**機組，每台 4% 時除氫**約 5 kg/h**，
  按**對氫氣濃度一階、對壓力成正比**建模，**約 1%** 催化起始，缺氧時**受氧限制**。整組數小時內慢慢除走數百 kg。
- **分佈式點火系統（輝光塞）**——**操作員備妥、預設關閉**。備妥且有電（全廠斷電時斷電）時，**約 930°C／1700°F**
  輝光塞將氫氣燒到 **4.1% 貧燃下限**，使其永不達可爆炸濃度。**過 ~13% 先遲備妥**會喺可爆炸帶點燃 → **爆轟**
  （尖峰加倍），即真實嘅遲動作風險。

當可燃、全方向傳播嘅混合物（**≥ 9%**）遇到點火源時觸發**自發爆燃**，一次燒晒飄散存量，加一次性 **AICC 壓力＋
溫度尖峰**，再由現有安全殼弛豫（被動熱阱／風機冷卻器／噴淋）衰減——即**三哩島二號**燃燒嘅急升／數分鐘衰減形態。
**蒸汽惰化**代理（熱而加壓嘅安全殼蒸汽豐富）喺洩壓階段抑制燃燒，直至噴淋／風機把蒸汽凝結後先燃燒——正合三哩島二號
時序（約 10 小時後燃燒）。**無氫氣時各項皆為零**，故正常運行可證不受影響。

### Key quantitative facts · 關鍵量化數據

| Parameter · 參數 | Value · 數值 |
|---|---|
| Containment free volume · 安全殼自由容積 | 73,624 m³ (2.6×10⁶ ft³), large-dry PWR |
| Lower flammability limit (upward) · 可燃下限（向上） | **4.0 vol%** H₂ |
| All-direction propagation · 全方向傳播 | **9.0 vol%** |
| DDT / detonable band · 爆轟／可爆炸帶 | **13–65 vol%** (peak hazard ~29.5%) |
| 10 CFR 50.44(c)(2) reg limit · 法規上限 | **10 vol%**, uniformly distributed |
| Steam inerting · 蒸汽惰化 | ≥ **55 vol%** steam → non-flammable |
| O₂ floor for combustion · 燃燒氧氣下限 | **5 vol%** O₂ |
| PAR bank · 複合器組 | **50 units**, ~5 kg/h/unit at 4 vol% (~250 kg/h bank) |
| Igniter surface temp · 點火器表面溫度 | **~930 °C / 1700 °F** |
| AICC spike · AICC 尖峰 | ~**32 kPa** & ~**78 °C** per vol% burned; cap ~8 atm / ~2500 K |
| Source stoichiometry · 源項化學計量 | Zr + 2H₂O → ZrO₂ + 2H₂ (0.0442 kg H₂/kg Zr) |
| TMI-2 validation · 三哩島二號驗證 | ~8 vol% burn → ~28 psig spike, no containment failure |

### New UI · 新介面

Five gauges (**Containment H₂** 0–10 vol% wide-range monitor per RG 1.97, **Containment O₂**, **PAR recombiner
rate**, **H₂ igniters** state, **last burn peak**), five alarms (H₂ FLAMMABLE / H₂ > 10% / H₂ DETONABLE / IGNITERS
ON / DEFLAGRATION), and an **Arm H₂ igniters** toggle under *Combustible-gas control* (default OFF). · 五個儀錶、
五個警報、一個*可燃氣體控制*下嘅**啟用氫氣點火器**開關（預設關閉）。

---

## 2026-06-25 — Quadrant Power Tilt Ratio (QPTR, LCO 3.2.4) + dropped-RCCA fault · 象限功率傾斜比（QPTR，LCO 3.2.4）連落棒故障

**Commit:** [`180b80a`](https://github.com/codingmachineedge/WinForge/commit/180b80a) on `feature/reactor-hyper`.

### What it models · 模擬內容

A PWR's ex-core nuclear instrumentation has **four power-range channels — N-41, N-42, N-43, N-44 (NI-41…44)** —
one in each core quadrant, each a stacked **upper + lower uncompensated ion chamber** that also feeds the axial
flux difference (ΔI / AFD). The **Quadrant Power Tilt Ratio (QPTR)** is the ratio of the **maximum** quadrant
detector reading to the **average** of the four, taking the larger of the upper-section and lower-section ratios.
A symmetric core reads **1.00**; **Tech-Spec LCO 3.2.4** limits QPTR to **1.02** (≤2% azimuthal tilt) in **MODE 1
above 50% RTP**. QPTR guards the *radial* power distribution — it keeps the enthalpy-rise hot-channel factor
FΔH and the peak-kW/ft factor FQ within the values the DNBR and linear-heat-rate safety
analyses assume.

The dominant abnormal cause of a tilt is a **dropped full-length RCCA**: a single control rod free-falls into the
core on loss of its gripper current. The rod is a strong local absorber, so **its quadrant is power-depressed**
(that ex-core detector reads **LOW**) and flux redistributes to the other three quadrants (they read **HIGH**),
driving QPTR to ~**1.03–1.10**. The run adds an operator fault that drops a rod into any chosen quadrant. The
tilt is modelled with **exact average conservation** — depressed quadrant `= 1 − 3k·r`, the other three
`= 1 + k·r` (so the four always sum to 4), with `k = 0.08` giving **QPTR ≈ 1.08** fully dropped. The rod inserts
**≈ −200 pcm** of single-rod worth through a **1.5 s** free-fall ramp, and the **QPTR peaking augmentation
multiplies FΔH and FQ in the W-3 DNBR calculation**, so anti-DNB margin erodes exactly as it
does on the plant. QPTR = 1.00 is a **no-op**, so a symmetric core leaves the existing kinetics / thermal / DNBR
baselines unchanged.

壓水堆堆外核儀有**四個功率量程通道——N-41、N-42、N-43、N-44（NI-41…44）**，每個堆芯象限一個，各由上下兩支
**未補償電離室**疊置組成，亦供軸向通量差（ΔI／AFD）。**象限功率傾斜比（QPTR）**＝最大象限探測器讀數 ÷ 四者
平均，取上段與下段比值之較大者。對稱堆芯讀數 **1.00**；**技術規格 LCO 3.2.4** 限 QPTR ≤ **1.02**（方位傾斜
≤2%），適用於**模式一、功率高於 50% 額定**。QPTR 守護*徑向*功率分佈——令焓升熱通道因子 FΔH 與
峰值線功率因子 FQ 保持在 DNBR 及線功率安全分析所假設嘅範圍內。

傾斜最主要嘅異常成因係**落棒（全長 RCCA 落底）**：單支控制棒因失去夾持電流而自由落入堆芯。該棒為強局部
吸收體，故**其象限功率受抑**（該堆外探測器讀數**偏低**），通量重新分佈至其餘三個象限（讀數**偏高**），令
QPTR 升至約 **1.03–1.10**。本次新增操作故障，可將控制棒落入任一象限。傾斜採用**精確保持平均值**模型——受抑
象限 `= 1 − 3k·r`、其餘三個 `= 1 + k·r`（四者恆和為 4），`k = 0.08`，全落時 **QPTR ≈ 1.08**。落棒經 **1.5
秒**自由落體斜坡插入約 **−200 pcm** 單棒棒價，而 **QPTR 峰值放大會乘以 W-3 DNBR 計算中嘅 FΔH 與
FQ**，令偏離核態沸騰餘裕如實下降。QPTR = 1.00 為**無作用**，對稱堆芯不改變現有動力學／熱工／DNBR
基線。

### Key quantitative facts / setpoints · 主要量化數據／設定點

| Item · 項目 | Value · 數值 | Source · 來源 |
|---|---|---|
| QPTR normal / limit · 正常／限值 | **1.00** flat · **1.02** limit (≤2% tilt) | Tech-Spec **LCO 3.2.4** |
| Applicability · 適用範圍 | MODE 1, **> 50% RTP** · 模式一、>50% 額定 | LCO 3.2.4 Applicability |
| Action A.1 power cut · 行動 A.1 降功率 | **≥ 3% RTP per 1%** QPTR over 1.00 (CT 2 h) · 每超 1% 降 ≥3% | LCO 3.2.4 Required Action A.1 |
| Ex-core channels · 堆外通道 | **4** power-range, N-41…N-44, upper+lower ion chambers · 4 通道 | NIS power-range |
| Dropped-RCCA QPTR · 落棒 QPTR | ~**1.03–1.10** single full-length rod · 單棒約 1.03–1.10 | core-physics typical |
| Single-rod worth · 單棒棒價 | **≈ 200 pcm** (range 100–800) inserted over **1.5 s** · 約 200 pcm | HFP RCCA worth |
| Tilt coefficient · 傾斜係數 | **k = 0.08** → depressed 0.76 / others 1.08 (Σ = 4) · 受抑 0.76／其餘 1.08 | model (avg-conserving) |
| DNBR coupling · DNBR 耦合 | FΔH 1.65 → 1.78, FQ 2.5 → 2.70 at QPTR 1.08 · 峰值因子放大 | W-3 hot-channel penalty |

### How it surfaces in the UI · 介面呈現

- New **Quad tilt (QPTR)** gauge (range 0.95–1.15) with a green ≤1.02 / amber / red band and a **1.02 limit**
  setpoint tick; label shows the live QPTR, the depressed quadrant (`Q1…Q4 rod`), and — when over limit — the
  LCO 3.2.4 **required power reduction** (`REDUCE −n%`). · 新增 **象限傾斜 QPTR** 儀表，含限值帶與 1.02 設定點。
- Annunciators **`QPTR > 1.02 (LCO 3.2.4)`** and **`DROPPED RCCA — ROD BOTTOM`**. · 新增警報。
- Operator controls **Drop Q1–Q4** and **Retrieve rod** under the rod-bank section (fully reversible). ·
  控制棒組區下新增 **落棒 Q1–Q4** 與 **復位落棒**（可逆）。

### Implementation notes · 實作備註

Pure managed C#, no new dependencies. State: `_qpd[4]` quadrant signals, `_droppedRodQuad`, `_dropRamp`; stepped
once per tick in `StepQptr(dt)` using the existing `Math.Min(1, dt/τ)` first-order-lag idiom (fall τ = 1.5 s,
tilt-settle τ = 3.0 s) with a per-tick renormalize so the average is exactly 1. The dropped-rod reactivity is
read from `_dropRamp` inside the kinetics sub-step (`StepKineticsAndThermal`); the peaking penalty multiplies
`F_dH`/`Fq_Total` inside `ComputeDnbr`. Files: `Services/ReactorSimService.cs`, `Services/ReactorScenarios.cs`
(gauge spec), `Pages/ReactorModule.xaml.cs`. Researched via the ultracode multi-agent loop. · 純託管 C#，無新依賴。

### Screenshots · 截圖

_None this run — screenshots are skipped in the unattended scheduled environment (computer-use capture cannot be
granted). · 本次無截圖：無人值守排程環境無法授予擷取權限。_

---

## 2026-06-25 — Core Exit Thermocouples + Subcooling Margin Monitor (post-TMI ICC, NUREG-0737 II.F.2) · 堆芯出口熱電偶連過冷度監測（TMI 後堆芯冷卻不足儀表，NUREG-0737 II.F.2）

**Commit:** [`cacf2f7`](https://github.com/codingmachineedge/WinForge/commit/cacf2f7) on `feature/reactor-hyper`.

### What it models · 模擬內容

After **Three Mile Island**, **NUREG-0737 Item II.F.2** required every PWR to add **Inadequate Core Cooling
(ICC) instrumentation** — a three-part set that tells the crew *whether the core is actually being cooled*:
**(1) RVLIS** reactor-vessel level (already in the sim), **(2) Core Exit Thermocouples (CETs)**, and **(3) a
Subcooling Margin Monitor (SMM)**. This run adds the remaining two thirds, completing the triad.

**Core Exit Thermocouples** are ~50–65 **Type-K (Chromel–Alumel)** thermocouples mounted at the *outlet* of
fuel assemblies across the core. In normal subcooled operation a CET reads a few °C above the loop hot-leg RTD
(`Thot`). But when the core **uncovers** (small-break LOCA, boil-off after loss of feed), the exposed fuel sits
in **superheated steam**, and the CET — unlike a hot-leg RTD that stays in liquid — climbs rapidly toward the
cladding temperature. That makes the **highest valid CET** the single best real-time indicator of core uncovery,
and the entry signal for the Westinghouse ERG **FR-C (core-cooling) Critical Safety Function** function-restoration
procedures. The model blends `CoreExitTempC` from `Thot` toward `max(Tsat, CladTempC)` by an
exposure × decay-heat weight, through a 6 s thermowell lag, clamped to the qualified **1260 °C (2300 °F)** ceiling.

The **Subcooling Margin Monitor** computes `SMM = Tsat(P) − max(Thot, CET)` — the conservative *higher-of*
reference. Positive = sub-cooled liquid; zero = saturation; **negative = superheat**, a direct ICC indication.
The monitor and the ICC RED/ORANGE status are **advisory/diagnostic only** — like RVLIS and the W-3 DNBR
readout they are never read by the protection system and command **no automatic scram**; the response is
operator/EOP-driven.

繼**三哩島**事故後，**NUREG-0737 II.F.2** 要求每座壓水堆加裝**堆芯冷卻不足（ICC）儀表**——三件套，用以告知
操作員*堆芯是否真正受到冷卻*：**(1) RVLIS** 壓力容器水位（模擬已有）、**(2) 堆芯出口熱電偶（CET）**、
**(3) 過冷度監測（SMM）**。本次加入餘下兩件，完成三件套。

**堆芯出口熱電偶**為約 50–65 支 **K 型（鎳鉻–鎳鋁）**熱電偶，裝於全堆芯燃料組件*出口*。正常過冷運行時 CET 讀
數略高於迴路熱腿 RTD（`Thot`）。但堆芯**裸露**（小破口 LOCA、失水後沸乾）時，外露燃料處於**過熱蒸汽**中，CET
（不似仍浸於液體嘅熱腿 RTD）會迅速向包殼溫攀升。故**最高有效 CET** 係堆芯裸露最佳即時指標，亦係西屋 ERG
**FR-C（堆芯冷卻）安全功能**恢復程序嘅進入訊號。模型按裸露度 × 衰變熱權重，將 `CoreExitTempC` 由 `Thot` 混合
向 `max(Tsat, 包殼溫)`，經 6 秒套管滯後，並限於合格上限 **1260 °C（2300 °F）**。

**過冷度監測** 計算 `SMM = Tsat(P) − max(熱腿溫, CET)`——保守「取大者」基準。正值＝過冷液；零＝飽和；
**負值＝過熱**，即直接嘅 ICC 指示。本監測連 ICC 紅／橙狀態僅屬**提示／診斷**——同 RVLIS、W-3 DNBR 一樣永不
被保護系統讀取，亦**不觸發自動停堆**；響應由操作員／EOP 主導。

### Key quantitative facts · 主要量化事實

| Item · 項目 | Value · 數值 | Source · 來源 |
|---|---|---|
| Sensor type · 感測器類型 | Type-K (Chromel–Alumel), ~41 µV/°C · K 型（鎳鉻–鎳鋁） | R.G. 1.97 |
| CET count · 熱電偶數量 | ~50–65 incore, ≥2 valid per quadrant · 約 50–65 支堆內 | NUREG-0737 II.F.2 |
| Qualified range · 合格量程 | 200–2300 °F (93–1260 °C); ceiling 1260 °C · 上限 1260 °C | R.G. 1.97 Cat 1 |
| Normal full-power CET · 滿功率正常值 | ≈ `Thot` + ~3 °C (321–327 °C) | — |
| SMM definition · 過冷度定義 | `Tsat(P) − max(Thot, CET)` (higher-of) · 取大者 | WOG ERG |
| **ICC RED (FR-C.1)** · 紅燈 | CET ≥ **1200 °F (649 °C)** — core damage imminent · 堆芯受損在即 | WOG ERG FR-C |
| **ICC ORANGE (FR-C.2)** · 橙燈 | CET ≥ **700 °F (371 °C)** *or* subcooling ≤ 0 · 或失去過冷 | WOG ERG FR-C |
| Thermowell response lag · 套管響應滯後 | 6 s (first-order) · 一階 | tuning |
| Actuation · 致動 | **Advisory only — no auto scram/ESF** · 僅提示，不自動停堆 | — |

### How it surfaces in the UI · 介面呈現

- **Core exit TC (CET) · 堆芯出口熱電偶** gauge — 200–2300 °F dial; reads °F + °C and appends `ICC ORG` / `ICC RED`.
- **Subcooling margin (SMM) · 過冷度監測** gauge — −30…+120 °C; shows `subcooled` (過冷) or `SUPERHEAT` (過熱) below zero.
- The existing **FR-C "C Cooling" Critical-Safety-Function tile** now turns ORANGE/RED off the CET/SMM ICC flags.
- Two new annunciator windows (`ICC ORANGE (FR-C.2)`, `ICC RED — CET >1200°F`) and a `CET` line on the compact status widget.

To watch it: trip the reactor and run a small-break LOCA / loss-of-feed scenario so the core boils down — the
CET separates from `Thot`, SMM crosses into superheat, and the FR-C tile escalates ORANGE → RED.

### Implementation notes · 實作備註

`Services/ReactorSimService.cs` — new `StepCet(double dt)` instrument (mirrors `StepRvlis`): **purely additive,
display-only**. It reads post-tick `Thot` / `PrimaryPressure` / `CladTempC` / `CollapsedLevelFrac` /
`CoreExposedFrac` / `DecayHeatFraction` and writes **only** `CoreExitTempC`, `CetSubcoolingMarginC` and two
advisory alarms — never kinetics/thermal/inventory/damage, so the meltdown/ECCS path is provably unaffected.
Called after `StepCladding` on both the normal and meltdown tick paths. UI in `Pages/ReactorModule.xaml.cs`
and `Pages/ReactorWindows.cs`. All new strings bilingual (EN + 繁體/粵語). Build clean, **0 errors**.

### Screenshots · 截圖

Skipped this run — computer-use screen capture cannot be granted in the unattended scheduled-run environment,
so the app was not launched (no stray process left). The change is verified by a clean `dotnet build` (0 errors).
· 本次略過：排程無人值守環境無法授予螢幕擷取權限，故未啟動程式（亦無遺留程序）。改動已以乾淨建置（0 錯誤）驗證。

---

## 2026-06-25 — RCS Pressure–Temperature limits (10 CFR 50 App G) + LTOP/COMS · 反應堆壓力容器 P/T 操作限值（10 CFR 50 附錄G）連低溫超壓保護 LTOP/COMS

**Commit:** [`3daf7e1`](https://github.com/codingmachineedge/WinForge/commit/3daf7e1) on `feature/reactor-hyper`.

### What it models · 模擬內容

An irradiated **reactor pressure vessel (RPV)** beltline is **brittle when cold**: a flaw can propagate by fast
fracture if pressure (membrane stress) is applied below the steel's ductile-to-brittle transition. **10 CFR 50
Appendix G** (via **ASME Section XI, Appendix G**) bounds the **allowable RCS pressure as a function of the
indicated coolant temperature**, building the plant's **Pressure–Temperature (P/T) limit curves**. This run adds
a faithful P/T-limit monitor plus **Low-Temperature Overpressure Protection (LTOP / COMS)** to the sim.

The allowable-pressure curve comes from the reference fracture-toughness relation

> **K_IC = 33.2 + 20.734·exp(0.02·(T − RT_NDT))**  (ksi·√in, T & RT_NDT in °F) — ASME XI App G eq. G-2210

with a **safety factor of 2.0** on the pressure (membrane) stress for normal heatup/cooldown (Service Level A/B)
and **1.5** for an inservice leak/hydrotest. As the vessel embrittles over life, the **adjusted reference
temperature** (ART = RT_NDT + ΔRT_NDT + margin, per **Reg. Guide 1.99 Rev. 2**) shifts the whole curve right.
For real-time robustness the sim stores a representative, monotone composite **heatup** limit as a (°C → MPa)
table (aged vessel, **~82 °C / 180 °F ART**) and interpolates it each tick into `MaxAllowablePressureMPa`;
`PtMargin`/`PtViolation` then track the brittle-fracture margin.

Below the **LTOP enable temperature (~135 °C / 275 °F Tcold)** the allowable pressure is low, so an inadvertent
**mass-input** (SI/charging) or **heat-input** (starting an RCP with the SG hotter than the primary) transient
can breach the limit in seconds. **LTOP/COMS** arms below that temperature (with hysteresis) and **re-ranges the
existing pressurizer PORV** to a low cold setpoint so it relieves *well below* the App G limit — no new relief
math, just a substituted setpoint into the existing PORV latch. A single-pole-filtered **signed RCS
heatup/cooldown rate** drives the Appendix-G **±100 °F/hr (±55.6 °C/hr)** rate alarm.

受過輻照嘅**反應堆壓力容器（RPV）**腰帶區喺**低溫時呈脆性**：若喺鋼材韌–脆轉變溫度以下加壓（薄膜應力），裂紋
可發生快速斷裂。**10 CFR 50 附錄 G**（經 **ASME 第XI卷 附錄 G**）按**指示冷卻劑溫度**限定**容許 RCS 壓力**，
構成電廠嘅**壓力–溫度（P/T）限值曲線**。本次為模擬加入忠實嘅 P/T 限值監測，連同**低溫超壓保護（LTOP/COMS）**。

容許壓力曲線源自參考斷裂韌性關係 **K_IC = 33.2 + 20.734·exp(0.02·(T − RT_NDT))**（ksi·√in，溫度單位 °F）—
ASME XI 附錄G 式 G-2210，正常升降溫（Service Level A/B）取**安全係數 2.0**，在役洩漏/水壓試驗取 **1.5**。容器
隨壽期脆化，**調整參考溫度**（ART = RT_NDT + ΔRT_NDT + 裕度，依 **Reg. Guide 1.99 Rev. 2**）令整條曲線右移。
為求即時穩健，模擬以代表性、單調嘅複合**升溫**限值（老化容器，**約 82 °C / 180 °F ART**）存成（°C → MPa）表，
逐拍內插成 `MaxAllowablePressureMPa`；`PtMargin`／`PtViolation` 追蹤脆性斷裂裕量。

喺 **LTOP 啟用溫度（約 135 °C / 275 °F Tcold）** 以下容許壓力偏低，故誤動嘅**質量輸入**（SI／充水）或**熱量
輸入**（喺 SG 比一迴路熱時啟動主泵）暫態可喺數秒內越限。**LTOP/COMS** 喺該溫度以下連滯環致動，將現有穩壓器
**PORV 重新整定**到低冷態整定值，令其遠低於附錄G 限值就洩放——無新增洩放算式，只係替換整定值入現有 PORV 閂鎖。
單極濾波嘅**有號 RCS 升降溫率**驅動附錄G **±100 °F/hr（±55.6 °C/hr）** 速率報警。

### Key quantitative facts · 關鍵量化數據

| Item · 項目 | Value · 數值 | Source · 來源 |
|---|---|---|
| K_IC reference curve · K_IC 參考曲線 | 33.2 + 20.734·exp(0.02·(T−RT_NDT)) ksi·√in | ASME XI App G G-2210 |
| Safety factor (normal / test) · 安全係數（正常／試驗） | **2.0 / 1.5** on pressure stress | App G G-2215 |
| Rate limit · 速率限值 | **±100 °F/hr = ±55.6 °C/hr** (alarm at 90%) | 10 CFR 50 App G |
| Criticality margin · 臨界裕度 | **+40 °F (+22.2 °C)** above the P/T-limit temp | 10 CFR 50 App G Table 1 |
| Representative ART · 代表性 ART | **~82 °C / 180 °F** (aged 4-loop) | Reg. Guide 1.99 Rev. 2 (generic) |
| LTOP enable temp · LTOP 啟用溫度 | **135 °C ≈ 275 °F** Tcold (5 °C disarm hysteresis) | representative |
| LTOP PORV setpoint · LTOP PORV 整定 | **open 3.10 / reseat 2.89 MPa-abs ≈ 435 psig** | representative |
| Min boltup temp · 最低螺栓上緊溫度 | **18 °C ≈ 65 °F** | App G (generic) |

*K_IC constants, the safety factors, the +40 °F criticality margin and the 100 °F/hr rate limit are
code-exact; the limit table, ART and LTOP setpoints are **representative generic** values, not a plant-specific
PTLR.* · *K_IC 常數、安全係數、+40 °F 臨界裕量同 100 °F/hr 限值為程式碼精確值；限值表、ART 同 LTOP 整定值為
**代表性通用**數值，並非特定電廠 PTLR。*

### How it surfaces in the UI · 介面呈現

Three new gauges — **P/T limit margin** (MPa to the App G allowable, red below 0 = violation), **RCS
heat/cool rate** (°F/hr & °C/hr with ±100 °F/hr limit bands), and **LTOP / COMS** status (Disarmed / Armed /
Relieving) — plus four annunciators: *P/T Limit Approach*, *App G P/T Violation*, *RCS Heat/Cool Rate Hi*, and
*LTOP/COMS Relieving*. All strings are bilingual (English + 繁體中文/粵語). · 三個新儀錶（P/T 裕量、RCS 升降溫率、
LTOP/COMS 狀態）連四個報警（P/T 接近、附錄G 越限、速率過高、LTOP 洩放），全部雙語。

### Implementation notes · 實作備註

Pure managed C# in `Services/ReactorSimService.cs`: a clamped piecewise-linear `Lerp` over the (°C, MPa) limit
table, an EMA rate filter (τ = 45 s, seeded to avoid a first-tick spike), LTOP arm/disarm with hysteresis, and a
one-line substitution of the effective PORV open/close setpoints into the existing `StepThermal` relief block
(`effClose < effOpen` is guaranteed by construction, so the latch never chatters). Gauges + limit bands in
`Pages/ReactorModule.xaml.cs` and `Services/ReactorScenarios.cs`. All new state resets cleanly per scenario.
Build: **0 errors**. · 全部純託管 C#，狀態每情景乾淨重置，建置 **0 錯誤**。

---

## 2026-06-25 — AMSAC: diverse ATWS mitigation (10 CFR 50.62) · AMSAC：多樣性 ATWS 緩解（10 CFR 50.62）

**Commit:** [`f5b61ce`](https://github.com/codingmachineedge/WinForge/commit/f5b61ce) on `feature/reactor-hyper`.

### What it models · 模擬內容

An **Anticipated Transient Without Scram (ATWS)** is an expected upset (e.g. loss of feedwater, turbine trip)
*combined with* a failure of the Reactor Protection System (RPS) to insert the rods. To bound this, the NRC's
**ATWS rule (10 CFR 50.62)** requires **AMSAC — ATWS Mitigating System Actuation Circuitry**: equipment that is
**diverse and independent from the RPS** and that, on its own logic, **trips the turbine and starts auxiliary
feedwater (AFW)**. This run adds a faithful AMSAC to the sim, layered on the existing ATWS flag (rods fail to
insert), AFW auto-start, EHC turbine trip, and the saturated-pressurizer / PORV / ASME-code-safety pressure model.

The key design principle is **diversity**: AMSAC reads **only process signals** — reactor power, steam-generator
narrow-range level, and main-feedwater state — and **never** reads `IsScrammed` or any RPS state, and **never
inserts rods**. Because of that, it still actuates when the reactor trip itself fails — exactly the ATWS case.
For a Westinghouse PWR no diverse *rod* insertion is needed: the strongly **negative moderator temperature
coefficient (MTC)** inherently rolls power back as the RCS heats, so **turbine-trip + AFW alone** (restoring the
secondary heat sink) keep peak RCS pressure below the **ASME Service Level C** limit. (Contrast B&W's *ARTS*,
which adds a diverse reactor trip because once-through SGs hold a smaller heat-sink inventory.)

An operator **"Defeat AMSAC"** demo toggle (default **OFF**, shown only for the ATWS scenario) lets you contrast
the **mitigated** transient (AMSAC trips the turbine, AFW restores the heat sink, pressure stays bounded) against
the **unmitigated** one (the pressurizer PORV and the three ASME code safety valves lift and peak pressure climbs
toward the ~3200 psia Level C limit).

**未能緊急停堆之預期暫態（ATWS）** 是一個預期的擾動（如喪失給水、汽輪機跳脫）**疊加**反應堆保護系統（RPS）未能
插棒。為設限，NRC 的 **ATWS 規則（10 CFR 50.62）** 要求設 **AMSAC——ATWS 緩解系統致動電路**：一套**與 RPS 多樣
且獨立**的設備，依自身邏輯**跳脫汽輪機並啟動輔助給水（AFW）**。本次為模擬加入忠實的 AMSAC，疊於既有的 ATWS 旗
標（控制棒未能插入）、輔助給水自動啟動、EHC 汽輪機跳脫，以及飽和穩壓器／PORV／ASME 規範安全閥壓力模型之上。

核心設計原則是**多樣性**：AMSAC **只**讀取製程訊號——反應堆功率、蒸發器窄量程水位、主給水狀態——**絕不**讀取
`IsScrammed` 或任何 RPS 狀態，且**絕不插棒**。正因如此，當反應堆跳脫本身失效時它仍會致動——正是 ATWS 情況。對
西屋壓水堆而言無需多樣性*插棒*：強烈的**負慢化劑溫度係數（MTC）** 會隨 RCS 升溫固有地壓回功率，故**單靠跳汽輪機
＋輔助給水**（恢復二次側熱阱）即可令一次側峰值壓力維持在 **ASME C 級**限值以下。（對比 B&W 的 *ARTS*，因直流式
蒸發器熱阱存量較小而加設多樣性反應堆跳脫。）

操作員的 **「停用 AMSAC」** 示範開關（預設**關閉**，僅 ATWS 情景顯示）可對比**已緩解**暫態（AMSAC 跳汽輪機、輔
助給水恢復熱阱、壓力受限）與**未緩解**暫態（穩壓器 PORV 與三個 ASME 規範安全閥起跳，峰值壓力攀向約 3200 psia 的
C 級限值）。

### Key quantitative facts · 主要量化事實

- **C-20 arming permissive = 40 % RTP** (first-stage-pressure power signal), with **5 % disarm hysteresis**
  (re-blocks below 35 %) — AMSAC is bypassed at low power where there is no challenge.
- **Initiating signal:** SG **low-low narrow-range level = 18 %** *OR* **loss of all main feedwater**
  (`FeedwaterFlow < 0.02` at power) — loss of the secondary heat sink.
- **Deliberate actuation delay = 25 s** so the RPS acts first on a normal trip the protection set already handles
  (the AMSAC time delay differentiates a real ATWS from an ordinary, successfully-tripped transient).
- **Output vector = { turbine trip = 1, AFW initiation = 1, rod insertion = 0 }.** AFW starts **immediately on
  actuation, bypassing the normal 60 s loss-of-MFW timer** (pumps still need a live AC bus for MDAFW or SG steam
  for TDAFW).
- **Figure of merit: ASME Service Level C peak-pressure limit = 22.06 MPa = 3200 psia** (≈ 1.2 × the 2500 psig
  RCS design pressure). The sim tracks the running **peak primary pressure** and exposes `AmsacMitigationOk`
  (peak stayed below Level C). The existing code safeties (`PzrSafetyAccum = 17.75 MPa`) lift well below Level C,
  so the *defeated*-AMSAC run visibly relieves through them while the mitigated run does not.
- **Diversity contract:** `StepAmsac(dt)` reads only `_power`, `IndicatedSgLevel`, `FeedwaterFlow`,
  `PrimaryPressure`; it **never** reads `IsScrammed` / `_rps` and **never** calls `Scram()`.

### Where it lives · 程式位置

- `Services/ReactorSimService.cs` — new `ReactorAlarm.AmsacActuated`; the AMSAC constants (C-20 40 %, 18 % SG
  lo-lo, 25 s delay, 22.06 MPa Level C); public `AmsacArmed` / `AmsacActuated` / `AmsacDefeated` /
  `PeakPrimaryPressureMpa` / `PeakPrimaryPressurePsig` / `AmsacMitigationOk`; `StepAmsac(double dt)` called from
  `UpdateProtection` **after** the RPS evaluation and P-9 turbine trip (so it is provably diverse); the AFW line
  in `UpdateScenarios` now honours the AMSAC latch; reset wiring in `ResetTrip`, `TriggerScenario` and `Reset`.
- `Pages/ReactorModule.xaml(.cs)` — the **AMSAC ACTUATED** alarm tile and the **"Defeat AMSAC (unmitigated
  ATWS)"** operator toggle (bilingual, default OFF, visible only for the ATWS scenario).

### How to see it · 如何觀察

Run the plant up past **40 %** power, then select the **ATWS (no scram)** scenario and induce a loss of heat sink
(e.g. **loss of feedwater**). The RPS demand latches but the rods stay put (**ATWS — RODS STUCK**); ~25 s after
SG level falls to lo-lo, **AMSAC ACTUATED** lights, the turbine trips and AFW starts — the heat sink returns and
peak pressure stays bounded. Now flip **Defeat AMSAC** ON and repeat: with no diverse mitigation the pressurizer
PORV and the ASME code safeties lift (**PZR SAFETY OPEN**) and the peak pressure climbs toward the 3200 psia
Level C limit — the licensing basis for why AMSAC exists.

把機組升至 **40%** 功率以上，選 **ATWS（未能停堆）** 情景並引致熱阱喪失（如**喪失給水**）。RPS 跳脫指令閂鎖但
控制棒不動（**ATWS 控制棒卡住**）；蒸發器水位跌至低低約 25 秒後，**AMSAC 致動**亮起，汽輪機跳脫、輔助給水啟
動——熱阱恢復，峰值壓力受限。再將 **停用 AMSAC** 開啟重做：無多樣性緩解下，穩壓器 PORV 與 ASME 規範安全閥起跳
（**穩壓器安全閥起跳**），峰值壓力攀向 3200 psia C 級限值——正是 AMSAC 存在的法規依據。

---

## 2026-06-25 — RVLIS reactor-vessel level instrumentation (post-TMI, NUREG-0737 II.F.2) · RVLIS 反應堆壓力容器水位儀表系統（TMI 後，NUREG-0737 II.F.2）

**Commit:** [`5fe9986`](https://github.com/codingmachineedge/WinForge/commit/5fe9986) on `feature/reactor-hyper`.

### What it models · 模擬內容

After the 1979 **TMI-2** accident — where operators had no direct reading of how much water was actually in the
reactor vessel and let the core uncover for hours — the NRC mandated (**NUREG-0737 item II.F.2**) a **Reactor
Vessel Level Instrumentation System (RVLIS)**. It is a **differential-pressure** instrument, RTD **density-
compensated**, that infers the *collapsed* (de-voided) liquid level in the vessel so operators can detect
**Inadequate Core Cooling (ICC)** and confirm **natural circulation**. This run adds a purely-additive,
**instrumentation-only** RVLIS reading on top of the existing inventory/cladding model — it reads the post-tick
vessel state and **never writes feedback state**, so the meltdown/ECCS physics is provably unchanged.

The instrument presents **three ranges**, and which one is trustworthy depends on the **reactor coolant pumps**:
- **Full Range** (collapsed level over the whole vessel, bottom-of-vessel → top-of-head) and **Upper Range**
  (hot-leg elevation → head) are valid only with **all RCPs off** (natural circulation / post-trip).
- **Dynamic Head Range** indicates **pump ΔP** and is the valid range whenever **≥1 RCP runs** — it confirms
  forced flow and distinguishes how many pumps are running; the level ranges read off-scale and are disregarded.

The model flips validity automatically on pump state, drains the lower-plenum band off the inventory deficit
once the fuel fully uncovers, and **collapses the dynamic-head reading as the sensed column voids** (loss of
subcooling). Two **advisory** alarms annunciate level below the top of active fuel and a full-range LO-LO — both
deliberately advisory, because the real **ICC trip / EOP FR-C.1 entry is owned by the core-exit thermocouples
(1200 °F) and the subcooling-margin monitor**, not by RVLIS alone.

1979 年 **三哩島 2 號（TMI-2）** 事故中，操作員無法直接讀出壓力容器內實際水量，令堆芯裸露數小時。其後 NRC 規
定（**NUREG-0737 II.F.2**）須設 **反應堆壓力容器水位儀表系統（RVLIS）**。此為**差壓**式、以 RTD 作**密度補償**
的儀表，推算容器內**塌陷（去蒸空）液位**，使操作員偵測**堆芯冷卻不足（ICC）**並確認**自然循環**。本次新增一個
純疊加、**僅作儀表用途**的 RVLIS 讀數，疊於既有的存量／包殼模型之上——只讀取每格更新後的容器狀態，**從不寫回
饋狀態**，故熔毀／ECCS 物理可證不變。

儀表設**三個量程**，哪個可信視乎**主泵**狀態：**全量程**（全容器塌陷水位，容器底→頂蓋）與**上量程**（熱腿標高
→頂蓋）僅在**全部主泵停**時有效；**動壓頭量程**指示**泵差壓**，只要**有一部主泵運轉**即為有效量程，用以確認強
迫流量並分辨運轉泵數，此時水位量程超量程而不予理會。模型按泵狀態自動切換有效量程，燃料全裸後按存量虧空抽乾下
腔室帶，並在感測水柱蒸空（喪失過冷度）時令動壓頭讀數**塌陷**。兩個**諮詢性**警報指示水位低於活性燃料頂及全量程
低低——刻意設為諮詢性，因真正的 **ICC 跳脫／EOP FR-C.1 進入準則由堆芯出口熱電偶（1200°F）及過冷度餘裕監測器**
擁有，而非單靠 RVLIS。

### Key quantitative facts · 主要量化事實

- **Three ranges, pump-state validity:** all RCPs **off** → Full + Upper (collapsed level) valid; **≥1 RCP on** →
  only Dynamic Head (pump ΔP) valid. The model exposes a two-state `RvlisValidRange { FullRange, DynamicHead }`.
- **Full-Range geometry (sim calibration):** bottom of active fuel ≈ **33 %**, **top of active fuel ≈ 62 %** of
  full-range span; above 62 % is the upper plenum/head. Covered + subcooled ramps **62 → 100 %** as the head fills.
- **LO-LO setpoint = 40 %** full range — inside the uncovered-fuel band (≈ the real-plant top-of-active-fuel band).
- **Dynamic-head normal indications (display):** 1 pump ≈ **38–43 %**, 2 ≈ **55–65 %**, 3 ≈ **78–85 %**, 4 = **100 %**
  ΔP; the reading is computed from the count-weighted `PumpedFlowFraction`, then **scaled by subcooling** so a
  voiding column under-reads — exactly the real instrument's failure mode.
- **ICC ownership:** the inadequate-core-cooling criterion is the **core-exit thermocouples at 1200 °F (649 °C)**
  plus subcooling margin; RVLIS is the **inventory** leg of the post-TMI ICC suite (RVLIS + CETs + subcooling),
  here providing advisory level alarms only — never a scram.
- **Contract:** `StepRvlis(dt)` reads only `CollapsedLevelFrac`, `PrimaryDeficitPct`, `RcpRunning[]`,
  `PumpedFlowFraction`, `SubcoolingMarginC`; writes only `RvlisFullRangePct` / `RvlisDynamicHeadPct` /
  `RvlisUpperRangePct` / `RvlisRange` + the two advisory alarms. All outputs `Math.Clamp`-bounded.

### Where it lives · 程式位置

- `Services/ReactorSimService.cs` — `enum RvlisValidRange`, two new `ReactorAlarm` members, the `Rvlis*`
  properties, the calibration constants, and `StepRvlis(double dt)` (called each tick right after `StepCladding`,
  including the meltdown path so the indication stays live).
- `Pages/ReactorModule.xaml.cs` — three new gauges (RVLIS full range / dynamic head / upper range, each showing a
  "— (pumps on/off)" off-scale tag for the invalid range) and two bilingual alarm tiles.

### How to see it · 如何觀察

Start at power with all four RCPs running → the **dynamic-head** gauge reads ~100 % and the level ranges show
"— (pumps on)". Trip the pumps (or run the **station-blackout / RCP seal LOCA** scenarios) → validity flips to
**Full Range**, dynamic head drops to "— (pumps off)", and as a LOCA/boil-off drains inventory the full-range
level walks down through 62 % (top of fuel), the **RVLIS < TOP OF FUEL** advisory annunciates, and the
**RVLIS LEVEL LO-LO** tile lights at 40 %.

開機在功率、四部主泵全開→**動壓頭**儀表讀約 100%，水位量程顯示「—（泵開）」。跳脫主泵（或執行**全廠斷電／主泵
軸封失水**情景）→有效量程切到**全量程**，動壓頭顯示「—（泵停）」；當失水／沸騰耗去存量，全量程水位逐步降穿
62%（燃料頂），**RVLIS 低於燃料頂**諮詢警報響起，至 40% 時 **RVLIS 水位低低**警報磚亮起。

---

## 2026-06-25 — RCP seal LOCA (loss of all seal cooling, WOG-2000) · 主泵軸封失水（喪失全部軸封冷卻，WOG-2000）

**Commit:** [`cd6aa24`](https://github.com/codingmachineedge/WinForge/commit/cd6aa24) on `feature/reactor-hyper`.

### What it models · 模擬內容

Each of the four reactor-coolant-pump shafts rides on a **3-stage film-riding face-seal package**. Normally
the No. 1 seal takes the full ~2235 psia drop with a small **controlled bleed-off (~3 gpm/pump)** that the
charging system makes up. The seal is kept cool two ways: **CCW** to the thermal-barrier heat exchanger, and
high-head **charging seal-injection** down the shaft. Lose **both** — which is exactly the station-blackout
condition (no AC bus to run a CCW pump or a charging pump) — and the stagnant seal water heats toward the
hot-leg, the elastomer O-rings degrade, and per-pump leakoff escalates through the canonical **WOG-2000 bins**.
At the gross-failure bin a 4-loop plant sheds **~1920 gpm — a ~2-inch small-break LOCA**. This makes the
existing **SBO** consequential: a seal LOCA now develops *emergently* once the buses die, the classic SBO
core-damage path. A dedicated **RCP seal LOCA** scenario injects loss-of-all-seal-cooling with AC still up.

四部主泵軸轴各有**三級貼膜端面軸封組**。正常時 1 號軸封承受約 2235 psia 全壓降，伴隨小量**受控洩流（每泵約
3 加侖/分）**由上充系統補回。軸封以兩條路徑冷卻：**CCW** 至熱障熱交換器，及高壓**上充軸封注入**。兩者同時喪
失（即全廠斷電 SBO——無交流匯流排開動 CCW 泵或上充泵），滯留嘅軸封水即向熱腿升溫，彈性體 O 形圈劣化，每泵
洩漏沿 **WOG-2000 檔位**遞升。全失效檔時四迴路電廠洩漏**約 1920 加侖/分——即約 2 吋小破口失水**。此舉令既有
**SBO** 具實質後果：匯流排死亡後軸封失水**自然演變**而成，正是 SBO 典型堆芯損壞路徑。另設專用 **主泵軸封失水**
情景，於交流電仍在時注入「喪失全部軸封冷卻」。

### Key quantitative facts · 主要量化事實

- **Seal package:** 3 film-riding face seals lumped to one cavity per pump; normal controlled bleed-off **3 gpm/pump**.
- **WOG-2000 degraded leakoff bins (per pump):** **21 / 76 / 182 / 480 gpm** — i.e. 4-loop totals **84 / 304 / 728 / 1920 gpm**.
  21 = intact-but-hot floor, 182 = NRC-assumed popped O-ring, **480 = gross failure (≈2-inch SBLOCA, bounding)**.
- **Cavity-temperature bin breakpoints:** **93 °C (200 °F)** → 21 gpm; **200 °C (392 °F)** → 76 gpm; **260 °C (500 °F)** → 182 gpm; **320 °C (≈hot-leg)** → 480 gpm.
- **Heat-up:** first-order toward `Thot`, **τ = 900 s**; from the 50 °C cooled datum the cavity crosses the
  76 gpm bin at ≈ **13 min** — the canonical **WOG-2000 time-to-onset** of seal failure on loss of all cooling.
- **Latched degradation:** seal integrity only ever decreases — an extruded O-ring does **not** reseat when
  cooling returns, so restoring cooling **before** a higher bin is reached is the only thing that arrests the climb.
- **Cooling gating:** `SealCoolingAvailable = MotorEccsSiAvailable (charging seal-injection) OR AnyAcBusEnergized
  (CCW thermal barrier)`. Both lost ⇒ heat-up ⇒ exactly the no-AC-bus SBO condition.
- **Inventory coupling:** net leak = `total · √(P/P_program) − one charging pump (132 gpm) while an AC bus lives`,
  folded into the shared `PrimaryDeficitPct` accumulator at **0.0004 %/s per gpm** (calibrated so 1920 gpm ≈ a
  0.6-area SBLOCA, while the 12 gpm normal bleed-off is fully made up → no deficit in normal operation). The
  `√(P/Pnom)` factor self-limits the leak as the RCS depressurizes (like the SGTR dP term).

### How it surfaces · 介面呈現

- New **RCP seal leakoff** gauge (0–1920 gpm) showing total leak + hottest cavity temp + a `NO COOL` flag, with
  WOG-2000 setpoint ticks at the 84 / 728 / 1920 gpm bin totals.
- New **RCP SEAL LOCA · 主泵軸封失水** annunciator (lit when cooling is lost and the cavity has heated into a degraded bin).
- New **RCP seal LOCA — loss of seal cooling · 主泵軸封失水 — 喪失軸封冷卻** entry in the scenario selector.

### Files · 檔案

`Services/ReactorSimService.cs` (seal fields/constants, `StepSeals`, `UpdateScenarios` deficit/pressure coupling,
alarm, resets, scenario case), `Services/ReactorScenarios.cs` (`RcpSealLoca` enum + `sealLeak` gauge spec),
`Pages/ReactorModule.xaml.cs` (scenario combo + switch, alarm label, gauge).

### Sources · 來源

WCAP-15603 Rev.1-A (Westinghouse RCP seal performance under SBO / WOG 2000 seal-leakage model);
NUREG/CR-4550 & NUREG-1150 (Surry/Sequoyah SBO sequences); NUREG/CR-6890 (Reevaluation of Station Blackout Risk).

---

## 2026-06-25 — Main condenser vacuum / backpressure model · 主凝汽器真空／背壓模型

**Commit:** [`b93248a`](https://github.com/codingmachineedge/WinForge/commit/b93248a) on `feature/reactor-hyper`.

### What it models · 模擬內容

The **main condenser** is the cold end of the Rankine cycle — the heat sink the turbine exhausts into. Its
absolute pressure (the **backpressure** / **vacuum**) sets how much enthalpy the LP turbine can extract: a
deeper vacuum means more output, a degrading vacuum costs output and, if it collapses, trips the turbine.
Until this run the sim treated electrical output as a fixed `min(power×0.33, first-stage)×1150 MWe` map and
modelled the condenser only as an infinite steam-dump sink. This run adds a lumped condenser heat-sink
(`UpdateCondenser`, `Services/ReactorSimService.cs`) whose backpressure emerges from the circulating-water
inlet temperature, the turbine load, and the air-removal system — and feeds back into output, alarms, the
steam-dump interlock and the turbine trip.

主凝汽器係朗肯循環嘅冷端——汽輪機排汽嘅熱阱。其絕對壓力（**背壓**／**真空**）決定低壓缸可抽取幾多焓：真空越
深，出力越多；真空惡化會損失出力，若真空崩潰更會令汽輪機跳脫。本次之前模擬將電功率當作固定映射，凝汽器只當
作無限蒸汽旁路熱阱。今次新增集總式凝汽器熱阱，背壓由循環水入口溫度、汽輪機負荷同抽氣系統決定，並回饋到出力、
警報、蒸汽旁路閉鎖同汽輪機跳脫。

### Key quantitative facts · 主要量化事實

- **Condensing temperature:** `Tcond = CW_inlet + CW_rise·loadFrac + TTD·loadFrac`, with full-load CW rise
  **10 °C**, terminal ΔT **4 °C**, first-order lagged **τ = 20 s**. Design point: 25 °C inlet → **39 °C** condensing.
- **Backpressure:** Magnus/Arden-Buck water saturation `Psat = 0.6112·exp(17.62T/(243.12+T))` kPa **+** a
  non-condensable **air partial pressure** (Dalton). Full load @ 25 °C CW inlet → **~6.77 kPa = 2.0 inHgA**, the
  design point where the output correction is exactly **1.000** (present 1150 MWe unchanged).
- **Output correction:** exhaust-pressure curve `factor = 1 − 0.0045·(P_kPa − 6.77)` (≈ **−1.5 %/inHg**), clamped
  to **0.80–1.04**, with a **1.0 inHgA (3.39 kPa) LP last-stage choking floor** below which deeper vacuum gives no
  further gain. Validation: 1.5 inHgA → ×1.008; 3.0 inHgA → ×0.985; 5.0 inHgA → ×0.954.
- **Setpoint band (ordered):** **CONDENSER VACUUM LOW** annunciator @ **5.0 inHgA** (clears 4.5, hysteresis);
  **condenser-available steam-dump interlock** drops out @ **7.0 inHgA** (re-arms 6.0) so the 40 % dump is blocked
  and relief shifts to the MSSV path; **low-vacuum turbine trip** @ **8.0 inHgA** latches `TurbineTripped`, which the
  existing **P-9** interlock cascades into a reactor trip above 50 % power (rides the runback below it).
- **Air-removal dynamics:** baseline in-leakage **0.02 kPa/s** balanced by an ejector removal authority of
  **0.10 kPa/s** (settles ~0.2 kPa, recovery τ ≈ 10 s). `AirEjectorLost` lets it rise unbounded over minutes;
  `CircWaterLost` adds **0.08 kPa/s** for a faster ~1–3 min path to the trip.
- **Inputs / display:** settable **`CirculatingWaterInletC`** boundary input (clamped 1–40 °C) plus `AirEjectorLost`
  / `CircWaterLost` event toggles; a new **Condenser vacuum** gauge shows inHgA / kPa / the output factor.
- **Architecture:** single-writer, runs after the secondary and before the steam dump. It only **scales an output
  term** (already `min`-capped) and **blocks a cooling bypass** — it never adds heat to the primary, so the
  meltdown-arm cooling-only safety path is unaffected. All integrators use `Min(1, dt/τ)` and clamp, stable at the
  50 ms substep.

單一寫入者，於二次側之後、蒸汽旁路之前運行。只**縮放輸出項**（已受 `min` 上限約束）同**閉鎖一條冷卻旁路**，從不向
一回路加熱，故熔毀解除（只冷卻）安全路徑不受影響。所有積分器用 `Min(1, dt/τ)` 並設限，50 毫秒子步穩定。

### Research · 研究

Researched via an ultracode multi-agent pass: three parallel agents (condenser thermodynamics; backpressure-vs-output
turbine performance; low-vacuum protection / interlocks) synthesised into one quantitative implementation spec.

經 ultracode 多代理研究：三個並行代理（凝汽器熱力學、背壓對出力嘅汽輪機性能、真空低保護／閉鎖）綜合為一份量化實作規格。

---

## 2026-06-25 — Real-time minimum DNBR via the Westinghouse W-3 critical-heat-flux correlation · 以西屋 W-3 臨界熱流關聯式即時計算最小偏離核態沸騰比 DNBR

**Commit:** [`bdaf023`](https://github.com/codingmachineedge/WinForge/commit/bdaf023) on `feature/reactor-hyper`.

### What it models · 模擬內容

**DNBR** (Departure-from-Nucleate-Boiling Ratio) is *the* central thermal-hydraulic safety parameter a PWR
operator watches: the ratio of the **critical heat flux** (the flux at which the cladding surface transitions
from efficient nucleate boiling to insulating film boiling) to the **actual local heat flux** at the hot spot.
At DNBR = 1.0 the hot rod is on the verge of boiling crisis and rapid clad overheating. Until this run the sim
*mentioned* DNBR only in a comment — it was never computed. This run adds a real, quantitative minimum-DNBR
instrument (`ComputeDnbr`, `Services/ReactorSimService.cs`) evaluated every tick from the lumped plant state.

DNBR（偏離核態沸騰比）是壓水堆操作員最關注的核心熱工水力安全參數：**臨界熱流**（包殼表面由高效核態沸騰轉為
絕熱膜態沸騰時嘅熱流）與熱點**實際局部熱流**之比。DNBR = 1.0 即熱棒瀕臨沸騰危機、包殼急速過熱。本次之前模擬只在
註解提及 DNBR，從未計算。今次新增真正可量化嘅最小 DNBR 儀表，每個時步由集總狀態計算。

### Key quantitative facts · 主要量化事實

- **Correlation:** the **Tong-1967 Westinghouse W-3** CHF correlation, evaluated in its native English units
  (psia, Btu/lbm, lb/hr-ft²), valid **1000–2300 psia**. SI plant state is converted at the boundary
  (`PrimaryPressure × 145.038 → psia`, `ΔT °C → °F` span ×1.8).
- **Local conditions from lumped state:** local heat flux `q″ = power × Fq(2.5) × q″_avg(0.189×10⁶ Btu/hr-ft²)`;
  hot-channel mass flux `G = flowFraction × 2.5×10⁶ lb/hr-ft²` (≈3460 kg/m²·s); local thermodynamic quality from
  inlet subcooling + enthalpy-rise factor **F_ΔH = 1.65** integrated to the **~2/3-height DNB node** (`AxialDnbFrac = 0.70`).
- **Saturation-enthalpy fits** (Btu/lbm, 1000–2300 psia): `hf = 397.7 + 0.1769P − 2.066×10⁻⁵P²`,
  `hfg = 730.9 − 0.2153P + 1.66×10⁻⁵P²`.
- **Limits / alarms:** **DnbrSafetyLimit = 1.30** (the W-3 95/95 design limit) and a **DnbrLowMargin = 1.55**
  warning, both gated above 15 % power so the off-scale-high low-power reading never trips them.
- **Behaviour:** off-scale-high (capped at **>10**) below 5 % power or under 2 % flow (a cold / no-flow core is
  not DNB-limited); ~**1.7–2.5** at nominal 100 % power, full flow, 2250 psia; falls toward / below **1.30** on a
  loss-of-flow (RCP coastdown) or overpower transient. First-order smoothed (τ = 2.5 s) for a steady gauge.
- **Architecture:** pure **display-only** instrument — single writer, never feeds back into kinetics, thermal,
  damage or the RPS. It *complements* (does not duplicate) the licensed anti-DNB protection, which remains the
  variable-setpoint **OverTemp ΔT / OverPower ΔT** trips. New **Min DNBR (W-3)** gauge on the reactor panel.

關聯式：Tong-1967 西屋 W-3，英制原生單位，適用 1000–2300 psia。局部熱流＝功率×Fq(2.5)×平均熱流；熱通道質量流速
＝流量分數×2.5×10⁶ lb/hr-ft²；局部含汽率由入口過冷度加 F_ΔH=1.65 焓升積分至約 2/3 高度 DNB 節點。安全限值 1.30
（W-3 95/95），低餘裕警告 1.55，均在 15% 功率以上方生效。低功率／停滯流時封頂為 >10；額定約 1.7–2.5，甩流量或超功率
時趨近 1.30。純儀表，不回饋物理或保護系統，輔助已有的超溫ΔT／超功率ΔT 防 DNB 跳脫。反應堆面板新增「最小 DNBR」表頭。

---

## 2026-06-25 — Steam dump / turbine bypass control: 40% condenser dump rides out a load rejection or turbine/reactor trip without an RPS trip · 蒸汽旁路（凝汽器排汽）控制：40% 排汽容量令甩負荷或汽輪機／反應堆跳機都唔使反應堆跳脫

**Commit:** [`ca0de37`](https://github.com/codingmachineedge/WinForge/commit/ca0de37) on `feature/reactor-hyper`.

### What it models · 模擬內容

Before this run, a load rejection or turbine trip was a dead end for the secondary: the governor valves
slammed shut (`steamDraw → 0`), the NSSS power had nowhere to go, the steam header pressure ran up toward
the **main steam safety valves (MSSV)**, and core temperatures climbed into the trip region. A real
Westinghouse 4-loop plant has a first line of defence the sim was missing — the **steam dump (turbine
bypass) system**, which bypasses up to **40 % of full main-steam flow directly to the condenser**, absorbing
the power-load mismatch so the plant rides out the upset **without a reactor trip** and **below the MSSV
liftpoint**. This run adds the dual-mode Westinghouse steam-dump controller (`UpdateSteamDump`,
`Services/ReactorSimService.cs`).

- **Dual-mode controller.** A **load-rejection mode** modulates dump demand on the temperature error
  `Tavg − Tref` (gain 0.20 /°C → saturates over a ~5 °C proportional band, the FSAR-typical 10–12 °F band),
  and a **trip-open mode** dumps toward the no-load Tavg datum **289.6 °C (≈553 °F)** (gain 0.05 /°C, softer
  ~20 °C ramp). The more demanding controller wins (`Max(loadRej, tripOpen)`), matching the real mode-select.
- **Arming + P-12 low-Tavg block.** The dumps arm on **turbine trip OR generator-breaker open OR reactor
  scram**. A smooth **P-12 low-Tavg block centred at 284.6 °C** (`NoLoadTavg − 5 °C`) cuts the dumps on a real
  overcooling event (e.g. an MSLB) so the bypass can never drive an excessive cooldown. Air-operated valve
  stroke is modelled as a 3 s first-order lag.
- **Cooling-only, meltdown-safe.** Both controller terms are `Max(0, …)`, so dump demand can never be
  negative — the bypass only ever removes secondary heat, never adds heat to the primary. The meltdown-ARM
  path (`FuelTemp`, `DamageAccumulation`) is untouched.
- **Plant coupling.** The 40 % dump flow feeds **(a)** the secondary heat sink `sgRemoval` — adding ≈0.28 MW
  per °C of primary-to-secondary head at full dump, so the primary keeps being cooled after the governor
  valves shut — and **(b)** the steam-header pressure target `pTarget` (relief term `−0.40·dumpFlow`, weaker
  than full turbine draw `0.6·steamDraw`), holding header pressure in the dump-controlled band below the
  MSSVs. Net effect: a 50–100 % load rejection now settles at no-load Tavg with the dumps open instead of
  tripping the reactor.
- **New telemetry.** A bilingual **Steam dump** gauge showing % of dump capacity and the active controller
  mode (Off / Armed / Load Reject / Trip Open / Lo-Tavg Block), plus read-only `SteamDumpDemand`,
  `SteamDumpPercent`, `SteamDumpArmed`, `SteamDumpModeEn` properties.

本次之前，甩負荷或汽輪機跳機對二次側嚟講係死路：調速汽門即刻關閉（`steamDraw → 0`），核蒸汽供應系統嘅功率無
處可去，蒸汽母管壓力衝向**主蒸汽安全閥（MSSV）**，堆芯溫度升入跳脫區。真實西屋四迴路電廠有一道模擬一直欠缺
嘅第一防線——**蒸汽旁路（凝汽器排汽）系統**，可將高達**滿載主蒸汽流量嘅 40%** 直接旁通到凝汽器，吸收功率與
負荷之間嘅失配，令電廠**唔使反應堆跳脫**、亦**唔到主蒸汽安全閥起跳點**就撐得住。本次新增西屋雙模式蒸汽旁路
控制器（`UpdateSteamDump`）。

- **雙模式控制器。** **甩負荷模式**按溫差 `Tavg − Tref` 調節排汽需求（增益 0.20／°C，約 5 °C 比例帶飽和，
  即 FSAR 典型 10–12 °F 帶）；**跳機全開模式**趨向無負荷 Tavg 基準 **289.6 °C（約 553 °F）**（增益 0.05／°C，
  約 20 °C 較柔斜率）。需求較大者勝（`Max(loadRej, tripOpen)`），對應真實模式選擇。
- **觸發＋P-12 低 Tavg 閉鎖。** 排汽於**汽輪機跳機、發電機斷路器斷開或反應堆緊急停堆**時待命。一個以 284.6 °C
  （`NoLoadTavg − 5 °C`）為中心嘅平滑 **P-12 低 Tavg 閉鎖**喺真正過冷事件（例如 MSLB）截斷排汽，令旁路永遠
  唔會造成過度冷卻。氣動閥行程以 3 秒一階滯後模擬。
- **只冷卻、防熔毀安全。** 兩個控制項都係 `Max(0, …)`，排汽需求永不為負——旁路只會移除二次側熱量，永不向
  一迴路加熱。熔毀啟動路徑（`FuelTemp`、`DamageAccumulation`）原封不動。
- **電廠耦合。** 40% 排汽流量耦合入 **(a)** 二次側熱阱 `sgRemoval`（滿排汽時每 °C 一二次側溫差增加約 0.28 MW，
  令調速汽門關閉後一迴路繼續被冷卻），同 **(b)** 蒸汽母管壓力目標 `pTarget`（釋壓項 `−0.40·dumpFlow`，弱過
  滿汽輪機抽汽 `0.6·steamDraw`），令母管壓力維持喺主蒸汽安全閥以下嘅排汽控制帶。整體效果：50–100% 甩負荷
  而家會喺排汽開啟下穩定於無負荷 Tavg，而唔係跳反應堆。
- **新遙測。** 雙語 **蒸汽旁路** 儀表，顯示排汽容量百分比同當前控制模式（關／待命／甩負荷／跳機全開／低溫
  閉鎖），另加 `SteamDumpDemand`、`SteamDumpPercent`、`SteamDumpArmed`、`SteamDumpModeEn` 唯讀屬性。

### Key quantitative facts · 關鍵量化數據

| Parameter · 參數 | Value · 數值 |
| --- | --- |
| Dump capacity to condenser · 凝汽器排汽容量 | **40 %** of full main-steam flow |
| Load-rejection gain / band · 甩負荷增益／比例帶 | 0.20 /°C → full open over ~5 °C (`Tavg − Tref`) |
| Trip-open target (no-load Tavg) · 跳機全開目標（無負荷 Tavg） | **289.6 °C (≈553 °F)**, gain 0.05 /°C |
| P-12 low-Tavg block · P-12 低 Tavg 閉鎖 | centre **284.6 °C**, 6 °C band |
| Valve stroke lag · 閥行程滯後 | 3.0 s (air-operated) |
| Pressure relief coupling · 壓力釋放耦合 | `−0.40·dumpFlow` (< `0.6·steamDraw` full draw) |

---

## 2026-06-25 — Westinghouse Tavg/Tref automatic rod control: load-programmed reference + deadband + variable-speed program · 西屋 Tavg／Tref 自動棒控：按負荷編程參考溫度＋死區＋變速程序

**Commit:** [`0c7ae77`](https://github.com/codingmachineedge/WinForge/commit/0c7ae77) on `feature/reactor-hyper`.

### What it models · 模擬內容

The AUTO rod controller used to be a crude proportional loop that drove the rods straight at a **power**
setpoint (`AutoPowerSetpoint − _power`). A real Westinghouse plant does the opposite: the rod control
system regulates **average coolant temperature Tavg** to a **turbine-load-programmed reference Tref**, and
reactor power emerges as whatever satisfies the steam load at Tavg = Tref. This run replaces the loop with
the real control scheme from the NRC Westinghouse Technology Systems Manual §8.1 (`UpdateAutoRods`,
`Services/ReactorSimService.cs`).

- **Tref program (linear in turbine load).** `Tref = NoLoadTavg + (FullLoadTavg − NoLoadTavg)·load`, where
  `load = FirstStagePressure` — the turbine first-stage (impulse) chamber pressure, exactly the load signal
  Tref is programmed against on the real plant. Endpoints **289.6 °C (557 °F) no-load → 305 °C (≈581 °F) full
  load**, the canonical 15.4 °C span, anchored at the existing 305 °C full-power datum so OTΔT/OPΔT and the
  criticality baseline are undisturbed. Raise turbine load and Tref rises, Tavg lags, rods withdraw to follow.
- **Power-mismatch anticipatory term.** The Tavg−Tref error is summed with `k·(load − _power)` (k = 3 °C per
  unit), so the rods start moving the instant turbine load diverges from nuclear power — before Tavg has
  measurably shifted — and the term self-decays as power re-tracks load, reproducing the manual's rate
  comparator.
- **±1.5 °F deadband + variable-speed program.** No rod motion inside ±0.83 °C of the combined error. Outside
  it, the speed program: **8 steps/min** min/lockup from 1.5–3 °F, a **linear ramp to 72 steps/min** max over
  3–5 °F. Hot → insert (counter down); cold → withdraw (counter up). Bumpless transfer on engaging AUTO is
  preserved, and the counter drives the existing 228-step / 128-step-overlap four-bank sequencing.
- **New telemetry.** A bilingual **Reference Tref** gauge beside Tavg, plus a live AUTO read-out of Tref, the
  Tavg−Tref ΔT (°F) and the commanded rod direction/speed (steps/min). The meltdown-ARM path is untouched.

自動控制棒以前係粗略嘅比例迴路，直接追**功率**設定值（`AutoPowerSetpoint − _power`）。真實西屋電廠啱啱相反：
棒控系統將**冷卻劑平均溫 Tavg** 調節至**按汽輪機負荷編程嘅參考溫度 Tref**，反應堆功率則自然落喺滿足蒸汽負荷、
令 Tavg = Tref 嘅水平。本次按 NRC 西屋技術手冊 §8.1 換成真實控制方案。Tref 隨汽輪機負荷（第一級／衝動室壓力
`FirstStagePressure`）線性變化，端點 **289.6 °C（557 °F）零負荷 → 305 °C（約 581 °F）滿載**，15.4 °C 標準跨度，
錨定喺現有 305 °C 滿功率基準，唔影響超溫／超功率 ΔT 同臨界基線。加大汽輪機負荷，Tref 上升、Tavg 滯後、控制棒
抽出跟隨。溫度誤差再加上功率失配前饋項 `k·(負荷 − 功率)`（k = 3 °C／單位），令負荷一偏離功率控制棒即刻郁，
功率追返負荷後自動衰減。±1.5 °F（±0.83 °C）死區內唔郁棒；死區外按變速程序：1.5–3 °F 最低／鎖定 **8 步/分**，
3–5 °F 線性升至最高 **72 步/分**。過熱插棒、過冷抽棒，保持無擾切換，並驅動原有 228 步／128 重疊四組序列。新增
雙語 **參考溫度 Tref** 錶連即時自動 ΔT／棒速顯示；熔毀 ARM 路徑不變。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| No-load Tref · 零負荷 Tref | 289.6 °C (557 °F) |
| Full-load Tref · 滿載 Tref | 305.0 °C (≈581 °F, = NominalTavg) |
| Programmed span · 編程跨度 | 15.4 °C (27.7 °F), linear in turbine impulse pressure |
| Deadband · 死區 | ±0.833 °C (±1.5 °F ΔT) |
| Min / lockup speed · 最低／鎖定棒速 | 8 steps/min (1.5–3 °F error) |
| Max speed · 最高棒速 | 72 steps/min (≥5 °F error) |
| Proportional ramp · 比例斜率 | 57.6 spm per °C (3→5 °F: 8→72 spm) |
| Power-mismatch gain k · 功率失配增益 | 3.0 °C per unit (load − power) |

_Source: NRC Westinghouse Technology Systems Manual §8.1 Rod Control (ML11223A252) + §02.3 Turbine Impulse
Pressure Channel (ML11216A054). Researched via ultracode (3 parallel research agents + synthesis)._

---

## 2026-06-25 — Samarium-149 / Promethium-149 second fission-product poison + post-trip samarium dead-time · 釤-149／鉕-149 第二裂變產物毒物連停堆後釤死區

**Commit:** [`a3fd69f`](https://github.com/codingmachineedge/WinForge/commit/a3fd69f) on `feature/reactor-hyper`.

### What it models · 模擬內容

Until now xenon-135 was the **only** neutron poison in the core, which left out the **second** of the two
poisons every reactor operator is taught — and the one with the most counter-intuitive shutdown behaviour.
This run adds the **Nd-149 → Pm-149 → Sm-149** chain (neodymium lumped into direct promethium production)
alongside the existing I-135 → Xe-135 model, sharing the same normalized formulation (`UpdateXenon`,
`Services/ReactorSimService.cs`).

- **Promethium-149** (β-emitter, t½ ≈ 53.1 h) is produced in proportion to fission power and decays into
  samarium. It is the slow reservoir that drives the post-shutdown transient.
- **Samarium-149 is STABLE.** Unlike Xe-135 it has **no radioactive decay** — it is removed **only** by
  neutron burnout (absorption, σ ≈ 4×10⁴ barns), so the burnout term is proportional to flux and **vanishes
  at shutdown**.
- **Flux-independent equilibrium worth.** Because both the production (via Pm) and the burnout terms scale
  with flux, equilibrium samarium is **independent of power level**: Sm_eq = λ_Pm·γ_Pm/σ. Normalized so
  equilibrium full-power Samarium = 1 with worth **≈ −640 pcm** (about ¼ of xenon, roughly −1 dollar).
- **The samarium dead-time — opposite shape to xenon.** After a trip there is **no peak-and-decay**: the
  leftover Pm-149 keeps converting to stable Sm-149 with no flux to burn it out, so samarium **builds
  monotonically to a permanent higher plateau** of ~2.84 normalized (worth ≈ **−1816 pcm**, an extra
  ~−1176 pcm beyond the operating value) over ~10–13 days, governed by the Pm-149 53 h half-life. The
  **Xenon restart** scenario now seeds a promethium reservoir + partial samarium build-in on top of the
  iodine-pit xenon peak.
- Purely additive: folds one term (`samariumRho`) into the reactivity sum and adds a **bilingual Samarium
  gauge** reading −pcm; the meltdown-ARM path is untouched.

直到現在氙-135 係堆芯中**唯一**嘅中子毒物，遺漏咗操作員必學兩種毒物中嘅**第二種**——亦係停堆行為最反直覺
嗰種。本次加入 **Nd-149 → Pm-149 → Sm-149** 鏈（釹併入直接鉕產生），與現有 I-135 → Xe-135 模型並列、共用
同一套正規化公式。鉕-149（β 衰變，半衰期約 53.1 小時）按功率產生並衰變成釤；釤-149 **穩定**，冇放射性衰變，
**只靠中子燒蝕移除**，故燒蝕項與通量成正比、停堆時消失。因產生與燒蝕均隨通量變化，**平衡釤毒與功率無關**，
正規化使滿功率平衡釤毒 = 1、棒價 **約 −640 pcm**（約氙嘅四分一，約 −1 dollar）。停堆後**唔會先升後降**：剩低
嘅鉕持續轉化成穩定釤又冇通量去燒，釤毒於約 10–13 日內**單調升至永久較高平台**約 2.84（約 **−1816 pcm**，比
運行值多約 −1176 pcm），由鉕 53 小時半衰期主導——即**釤死區**。氙毒重啟情景現額外注入鉕儲備與部分釤積累。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Pm-149 decay constant λ_Pm · 鉕-149 衰變常數 | 3.626×10⁻⁶ s⁻¹ (t½ ≈ 53.1 h) |
| Sm-149 burnout rate σ·φ at full power · 滿功率釤燒蝕率 | 6.6613×10⁻⁶ s⁻¹ (τ ≈ 41.7 h) |
| Normalization γ_Pm · 正規化常數 | 1.8371 (= σ/λ_Pm → Sm_eq = 1) |
| Equilibrium full-power worth · 滿功率平衡棒價 | **−640 pcm** (flux-independent · 與通量無關) |
| Post-shutdown asymptotic Sm · 停堆漸近釤毒 | ≈ 2.84 normalized → **−1816 pcm** |
| Extra negative beyond operating · 超出運行值額外 | ≈ −1176 pcm |
| Sm-149 thermal absorption σ_a · 釤-149 熱吸收截面 | ≈ 4.0×10⁴ barns |
| A=149 chain fission yield (U-235) · 質量數 149 鏈裂變產率 | ≈ 1.08 % |
| Buildup time scale · 積累時間尺度 | ~10–13 days (Pm 53 h t½) |

### Screenshots · 截圖

Skipped this run — the scheduled-run environment cannot grant the interactive desktop/computer-use access
needed to launch the WinUI app and capture the reactor panel. The change is verified by a clean
`dotnet build` (0 errors). · 本次略過：排程環境無法授予啟動 WinUI 程式並截取反應堆面板所需嘅互動桌面／
電腦操作權限。改動已以乾淨建置（0 錯誤）驗證。

---

## 2026-06-25 — LOCA core-uncovery → Peak Cladding Temperature + 10 CFR 50.46 acceptance criteria · LOCA 堆芯裸露→峰值包殼溫度連 10 CFR 50.46 驗收準則

**Commit:** [`8056472`](https://github.com/codingmachineedge/WinForge/commit/8056472) on `feature/reactor-hyper`.

### What it models · 模擬內容

Until now the **LOCA** scenario only bled primary pressure and pressurizer level and armed ECCS — there was
**no core-damage progression**, so the headline metric of every emergency-core-cooling analysis (will the
fuel survive?) simply did not exist. This run adds a purely-additive `StepCladding()` instrumentation model
(`Services/ReactorSimService.cs`) that turns a loss of inventory into the real consequence chain and scores it
against the three **quantitative 10 CFR 50.46(b)** ECCS acceptance criteria.

- **Collapsed core liquid level.** A two-phase mixture level over the active fuel, derived **algebraically**
  from the RCS inventory deficit. A LOCA break and a **saturated boil-off** path (SG heat sink lost + RCS at
  saturation, e.g. after the SBO battery dies) now accrue that deficit. Top-of-active-fuel uncovers at ~8 %
  deficit; the core is fully uncovered by ~34 %.
- **Peak Cladding Temperature (PCT).** A lumped hot-channel cladding node for the **uncovered** part of the
  core, heated by decay heat × an Fq ≈ 2.5 peaking factor, cooled by steam/radiation. It **quenches** rapidly
  back toward the coolant temperature when ECCS / accumulators recover the level. `PeakCladTempC` is a max-hold
  — the 50.46(b)(1) figure of merit.
- **Zircaloy–steam oxidation.** A parabolic (√t) reaction blending the **Cathcart–Pawel** correlation below
  ~1853 K and **Baker–Just** above, integrated as ∫d(W²)=Kp·dt so the weight gain is monotone. It adds
  **exothermic heat** (the autocatalytic runaway above ~1500 °C), grows the **local oxidation (ECR)**, and
  liberates **hydrogen**.
- **The three quantitative 50.46(b) limits become live gauges + alarms.** Tuned so an **unmitigated**
  large-break LOCA or SBO boil-off drives PCT to the 1204 °C limit in tens of seconds, while a **mitigated**
  event (ECCS available) never uncovers the core. Writes **none** of `FuelTemp` / `DamageAccumulation` /
  meltdown state, so the meltdown-ARM path is provably untouched.

至今 **LOCA** 情景只洩放一迴路壓力與穩壓器水位並啟動應急堆芯冷卻——**沒有堆芯損毀進程**，以致每份應急堆芯
冷卻分析最核心的指標（燃料能否存活）根本不存在。本次新增純附加的 `StepCladding()` 儀表模型
（`Services/ReactorSimService.cs`），把存水流失轉化為真實的後果鏈，並以三項**量化 10 CFR 50.46(b)** 驗收
準則評分：**堆芯塌陷水位**（以一迴路存水虧損代數推導；破口與**飽和沸乾**路徑現會累積虧損，約 8 % 虧損時
燃料活性段頂裸露，約 34 % 時全裸露）；**峰值包殼溫度（PCT）**（裸露段集總熱通道節點，衰變熱乘 Fq≈2.5 熱點
因子加熱、蒸汽／輻射冷卻，水位回補時急速淬冷；`PeakCladTempC` 為峰值保持，即 (b)(1) 指標）；**鋯水氧化**
（拋物線反應，~1853 K 以下用 Cathcart–Pawel、以上用 Baker–Just，以 ∫d(W²)=Kp·dt 積分保持單調，放熱、增長
局部氧化 ECR 連產氫）；**三項 (b) 量化限值化為即時儀表連警報**（調校為：未緩解的大破口 LOCA 或 SBO 沸乾於
數十秒內把 PCT 推至 1204 °C 限值，而已緩解事件不會裸露堆芯）。模型**不寫入** `FuelTemp`／
`DamageAccumulation`／熔毀狀態，故熔毀啟動路徑不受影響。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| 50.46(b)(1) PCT limit · 峰值包殼溫度限值 | **1204.4 °C (2200 °F)** |
| 50.46(b)(2) max local oxidation · 最大局部氧化 | **17 % ECR** (equivalent cladding reacted) |
| 50.46(b)(3) core-wide hydrogen · 堆芯整體產氫 | **1 %** of all-clad-reacted (≈ 1141 kg full inventory) |
| 50.46(b)(4)/(5) · 可冷卻幾何／長期冷卻 | qualitative pass/fail (`CoolableGeometryOk`) |
| Zr–steam reaction onset · 鋯水反應起始 | ~800 °C; runaway > ~1500 °C |
| Cathcart–Pawel ↔ Baker–Just crossover · 相關式切換 | 1853 K |
| Zr–steam reaction enthalpy · 反應焓 | 6.45 MJ/kg Zr |
| Hot-channel peaking factor · 熱點因子 | Fq ≈ 2.5 (hot node) |
| Top-of-active-fuel uncovery · 燃料頂裸露 | ~8 % RCS inventory deficit |
| Full core uncovery · 全堆芯裸露 | ~34 % RCS inventory deficit |
| Accumulator discharge · 蓄壓器排放 | < 4.5 MPa (~650 psia N₂ cover gas) |
| Quench time constant on re-cover · 回淹淬冷時常數 | 0.8 s |

### New gauges & alarms · 新增儀表與警報

- **Gauges:** Peak clad temp (PCT, °C/°F live + max-hold, redline 1204 °C), Core collapsed level (% + % dry,
  shows **QUENCH**), Clad oxidation (% ECR, redline 17 %), Core hydrogen (% + kg, redline 1 %).
- **Alarms:** `CORE UNCOVERY · 堆芯裸露`, `PCT > 2200 °F (50.46)`, `CLAD OXID > 17 % ECR`, `CORE H₂ > 1 %`.

### Stability · 數值穩定性

The collapsed level is **algebraic** (cannot drift; recovers the instant ECCS pulls the deficit down); the
clad node uses the codebase's clamped-relaxation idiom (`x += (target−x)·min(1, h/τ)`, factor capped at 1,
τ ≫ sub-step → cannot overshoot, no stiff `exp(growth)` ever evaluated); oxidation integrates **W²** so W is
monotone; an internal 0.05 s sub-step engages **only above 1200 °C** to tame the autocatalytic term; hard
clamps backstop every output. · 塌陷水位為**代數式**（不漂移）；包殼節點沿用本庫的限幅鬆弛慣用法（不會過衝、
不評估剛性指數）；氧化以 **W²** 積分保持單調；僅在 1200 °C 以上啟用 0.05 s 內部子步抑制自催化項；所有輸出
均有硬限幅。

### Screenshots · 截圖

Skipped this run — the build targets `net11.0-windows10.0.26100.0` and the scheduled-run environment cannot
grant the interactive computer-use capture needed to drive the reactor window, so the panel could not be
captured. The change is verified by a clean `dotnet build` (**0 errors**). · 本次略過：建置目標為
`net11.0-windows10.0.26100.0`，排程環境無法授予驅動反應堆視窗截圖所需的互動式電腦操作權限，故未能截取面板。
改動已以乾淨建置（**0 錯誤**）驗證。

---

## 2026-06-25 — Class 1E electrical: offsite/EDG/sequencer + 125 VDC SBO battery + TDAFW · 1E 級廠用電：廠外電源／應急柴油機／負載排序＋125 VDC 斷電撐持電池＋汽動輔助給水

**Commit:** [`903220e`](https://github.com/codingmachineedge/WinForge/commit/903220e) on `feature/reactor-hyper`.

### What it models · 模擬內容

The **Station Blackout (SBO)** scenario used to be a one-liner: it just zeroed the pumps, feedwater and ECCS.
There was **no electrical plant at all** — no offsite power, no emergency diesels, no station battery — so an
SBO was instantly unsurvivable and none of the real coping equipment existed. This run adds a deterministic,
pure-managed-C# **Class 1E AC/DC distribution model** (`Services/ReactorElectrical.cs`) and wires the rest of
the plant to it.

- **Offsite (preferred) power + two 4.16 kV safety trains (A/B).** Normally both buses ride on the grid. A
  **Loss of Offsite Power (LOOP)** strips both buses dead.
- **Two Emergency Diesel Generators (the "10-second diesel").** On a LOOP (or a Safety Injection signal) each
  EDG auto-starts and reaches rated voltage/frequency in **10 s**, then its breaker closes onto the dead bus.
- **Load sequencer.** Safeguards loads are re-applied in **5-second blocks** (HHSI → RHR/LPSI → CCW → SW →
  containment fan coolers/spray) so each motor-start inrush decays before the next block — the reason real
  plants sequence rather than energize everything at once.
- **125 VDC vital station battery.** State-of-charge depletes **only while no AC source is available**, over a
  **4-hour coping time** (10 CFR 50.63). The charger recovers it the instant offsite or an EDG returns. A
  **DC load-shed** control multiplies coping by ~1.67×. Below SOC 0 the vital DC bus dies (instruments, RPS,
  TDAFW control).
- **SBO = LOOP + both EDGs failed.** The scenario now injects both faults, so the buses stay dead and the
  battery is the only thing keeping the plant instrumented.
- **The buses gate real equipment.** RCPs are large **non-1E** motors — they drop on a LOOP and cannot restart
  on diesel power (they coast down on their flywheels). Motor-driven **ECCS/SI** needs a live AC bus. **AFW**
  now splits into **motor-driven** (needs AC) versus the **turbine-driven AFW pump (TDAFW)** — steam-driven,
  needing only 125 VDC for its governor — which becomes the **sole decay-heat-removal path in a blackout**
  until the battery dies or steam pressure falls below the turbine's ~100 psig motive-steam band.

舊有的「全廠斷電」情景只是一行程式：把泵、給水同應急堆芯冷卻清零，**根本沒有電力系統**——無廠外電源、無應急
柴油機、無蓄電池，斷電即時無法挽救。本次新增確定性、純託管 C# 的 **1E 級交流／直流配電模型**
（`Services/ReactorElectrical.cs`），並把全廠接上去：廠外電源加兩列 4.16 kV 安全母線；兩部**「10 秒柴油機」**
（喪失廠外電源或安注訊號時 10 秒達額定電壓／頻率，斷路器合至失電母線）；**5 秒一組的負載排序**（高壓安注→
餘熱排出→設備冷卻水→廠用水→安全殼風冷／噴淋）；**125 VDC 蓄電池**，僅於喪失全部交流電時按 **4 小時撐持時間**
放電（10 CFR 50.63），任何交流電恢復即由充電器回充，**卸除直流負載**可延長約 1.67 倍。**全廠斷電＝喪失廠外
電源＋兩部柴油機皆失效**。母線閘控設備：主泵屬**非 1E**，喪失廠外電源即跳脫且無法以柴油電重啟；電動式
**應急堆芯冷卻／安注**需帶電交流母線；**輔助給水**分為**電動式**（需交流）與**汽動式（TDAFW）**——蒸汽驅動、
僅需 125 VDC 調速——後者於斷電時成為**唯一衰變熱排出途徑**，直至電池耗盡或蒸汽壓低於汽輪機約 100 psig 的
動力蒸汽下限。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Class 1E bus voltage · 1E 級母線電壓 | 4.16 kV (4160 V, 3-phase) |
| EDG start time (design basis) · 柴油機起動時間（設計基準） | ≤ 10 s to rated V/f |
| Load-sequencer block interval · 負載排序組距 | ~5 s per block (5 blocks) |
| Sequence order · 排序次序 | HHSI → RHR/LPSI → CCW → SW → Ctmt fan coolers/spray |
| Vital DC bus · 直流匯流排 | 125 VDC nominal (60-cell lead-acid) |
| Battery float / end-of-discharge · 浮充／放電終止 | ~132 V (SOC 1) / 105 V (1.75 V/cell) |
| SBO coping time · 斷電撐持時間 | 4 h (10 CFR 50.63 category; real-time) |
| DC load-shed factor · 卸載係數 | ×0.6 discharge (≈ ×1.67 coping) |
| TDAFW motive-steam floor · 汽動輔助給水動力蒸汽下限 | ~100 psig (design band 80–150) |
| LOV / degraded-voltage relays · 喪壓／降壓繼電器 | ~70 % / ~90 % nominal (modelled via LOOP strip) |

### Availability logic · 供電可用邏輯

| Equipment · 設備 | Available iff · 可用條件 |
|---|---|
| RCPs (non-1E) · 主泵（非 1E） | Offsite power present (lost on LOOP) |
| Motor-driven ECCS/SI · 電動應急堆芯冷卻／安注 | Any AC bus energized |
| Motor-driven AFW · 電動輔助給水 | AC bus + DC present |
| **TDAFW** · **汽動輔助給水** | **DC present AND SG steam > 100 psig** |

*The 10 s diesel start, 5 s sequencer blocks and 4 h coping are representative Westinghouse/NRC design-basis
figures; exact relay setpoints, block kW and battery Ah are plant-licensed. SBO coping here is modelled in
**real time** — the battery barely moves over a screenshot, exactly as a real 4-hour battery would.*

### New operator controls / indications · 新增操作員控制／指示

- **Vital DC battery** gauge — SOC % and terminal voltage, with a danger band below the 20 % end-of-discharge floor.
- **Shed non-vital DC loads** toggle — stretches the SBO coping time.
- Five new annunciators: **LOSS OF OFFSITE PWR · STATION BLACKOUT · EDG ON BUS · TURBINE-DRIVEN AFW · DC BUS DEPLETED**.

### Files · 檔案

`Services/ReactorElectrical.cs` (new model), `Services/ReactorSimService.cs` (`UpdateElectrical`, RCP/ECCS/AFW
gates, alarms), `Services/ReactorScenarios.cs` (`"battery"` gauge spec), `Pages/ReactorModule.xaml.cs`
(battery gauge, alarm tiles, DC load-shed control).

### Screenshots · 截圖

Skipped this run — the worktree builds to `net11.0-windows10.0.26100.0` and the scheduled-run environment
cannot grant the computer-use screenshot permission needed to capture the WinUI panel. The change is verified
by a clean `dotnet build` (0 errors). · 本次略過：建置目標為 `net11.0-windows10.0.26100.0`，排程環境無法授予
擷取 WinUI 面板所需的電腦操作截圖權限。改動已以乾淨建置（0 錯誤）驗證。

---

## 2026-06-25 — Containment pressure response + Hi-1/Hi-2/Hi-3 ESFAS · 安全殼壓力響應＋Hi-1／Hi-2／Hi-3 工程安全設施驅動

**Commit:** [`c03c20e`](https://github.com/codingmachineedge/WinForge/commit/c03c20e) on `feature/reactor-hyper`.

### What it models · 模擬內容

The accident scenarios (MSLB, LOCA) previously had **no containment**: a steam-line or coolant break
crashed secondary pressure and drained the RCS, but the building they discharge into did nothing, and the
three containment-pressure ESFAS signals that every real PWR runs on were absent. This run adds a lumped
**0-D containment-atmosphere node** (large-dry, 4-loop Westinghouse class) and its three pressure bistables.

- **One containment node.** Tracks gauge pressure (kPa-g / psig) and atmosphere temperature (°C / °F),
  starting at ~0 psig and ~49 °C (120 °F). It is **unconditionally stable**: every state relaxes by a
  `min(1, dt/τ)` factor toward a target, so it can never overshoot at any sim `dt`.
- **Mass/energy in.** An **in-containment MSLB** drives off the normalized break steam flow toward a
  ~350 kPa-g (51 psig) peak; a **LOCA** blowdown drives off break area toward a ~415 kPa-g (60 psig) peak
  with an ~8 s rise. The LOCA source **fades as the RCS depressurizes** (`×clamp(P_primary/6)`) — the energy
  *is* the hot pressurized primary flashing, so once the vessel empties the source decays to decay-heat
  boil-off and spray can win. **SGTR and out-of-containment breaks deliberately do not feed the node** — they
  bypass the containment boundary, so spray/isolation correctly stay quiescent.
- **Heat out (parallel conductances).** Passive steel/concrete heat sinks always condense (`τ = 300 s`);
  **fan coolers** (`τ = 120 s`, start on the safeguards sequence) and — decisively — **containment spray**
  (`τ = 30 s`) accelerate removal. Removal `τ = 1/Σ(1/τᵢ)`, so spray collapses the time constant and
  depressurizes the building.
- **Three ESFAS bistables (latching, anti-chatter ~1 psi deadband).** **Hi-1 (28 kPa-g / 4 psig)** →
  Safety Injection + **Containment Isolation Phase A** + reactor trip (the SI/P-4 path) + fan coolers.
  **Hi-2 (71 kPa-g / 10.3 psig)** → **Main Steam Line Isolation** (closes the MSIVs, terminating an MSLB
  blowdown). **Hi-3 (186 kPa-g / 27 psig)** → **Containment Spray** after a realistic ~35 s pump-start /
  valve-stroke delay + **Phase B isolation**.
- **Emergent payoff.** A large MSLB or LOCA now pressurizes containment on-screen; Hi-1 trips and isolates,
  Hi-2 slams the MSIVs (which self-terminates the MSLB and lets pressure decay), and a severe break climbs
  to Hi-3, sprays after the actuation delay, and rides the pressure back down — the full defence-in-depth
  sequence, all emergent from the setpoints rather than scripted.

事故情景（主蒸汽管爆裂、失水事故）此前**沒有安全殼**：破口令二次側壓力崩潰並排空一迴路，但其排放所進入的廠房
毫無反應，而每座真實壓水堆賴以運行的三個安全殼壓力工程安全設施訊號亦付之闕如。本次新增集總**零維安全殼大氣
節點**（大型乾式、四迴路西屋型）及其三個壓力雙穩態。

- **單一安全殼節點：** 追蹤錶壓（kPa-g／psig）與大氣溫度（°C／°F），起始約 0 psig、約 49 °C（120 °F）。
  **無條件穩定**：每個狀態以 `min(1, dt/τ)` 係數趨向目標，任何 `dt` 皆不會過衝。
- **質能輸入：** **殼內主蒸汽管爆裂**依歸一化破口蒸汽流趨向約 350 kPa-g（51 psig）峰值；**失水事故**依破口
  面積趨向約 415 kPa-g（60 psig）峰值，上升時間常數約 8 秒。失水來源**隨一迴路洩壓而衰減**（`×clamp(P一迴路/6)`）
  ——能量*即*高溫高壓一迴路的閃蒸，壓力容器排空後來源衰減至衰變熱沸騰，噴淋遂能取勝。**蒸發器爆管與殼外破口
  故意不饋入此節點**——它們繞過安全殼邊界，故噴淋／隔離正確地保持靜止。
- **移熱（並聯導熱）：** 被動鋼／混凝土熱阱持續冷凝（`τ = 300 秒`）；**風機冷卻器**（`τ = 120 秒`，隨安全
  設施程序啟動）與——決定性地——**安全殼噴淋**（`τ = 30 秒`）加速移熱。移熱 `τ = 1/Σ(1/τᵢ)`，故噴淋令
  時間常數崩塌並為廠房洩壓。
- **三個工程安全設施雙穩態（鎖存、防抖約 1 psi 死區）：** **Hi-1（28 kPa-g／4 psig）**→ 安全注入＋
  **安全殼隔離 A 階段**＋反應堆跳脫（SI／P-4 路徑）＋風機冷卻器。**Hi-2（71 kPa-g／10.3 psig）**→
  **主蒸汽管隔離**（關閉 MSIV，終止主蒸汽管洩壓）。**Hi-3（186 kPa-g／27 psig）**→ 經真實約 35 秒泵啟動／
  閥行程延遲後啟動**安全殼噴淋**＋**B 階段隔離**。
- **湧現效果：** 大型主蒸汽管爆裂或失水事故現在於螢幕上為安全殼增壓；Hi-1 跳脫並隔離，Hi-2 急關 MSIV
  （自行終止主蒸汽管爆裂並令壓力衰減），嚴重破口攀至 Hi-3、經啟動延遲後噴淋並將壓力壓回——完整的縱深防禦序列，
  全部由設定點湧現而非腳本化。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Hi-1 setpoint · Hi-1 設定點 | **28 kPa-g (4.0 psig)** → SI + Isolation Phase A + reactor trip |
| Hi-2 setpoint · Hi-2 設定點 | **71 kPa-g (10.3 psig)** → Main Steam Line Isolation |
| Hi-3 setpoint · Hi-3 設定點 | **186 kPa-g (27 psig)** → Containment Spray + Phase B |
| Design pressure · 設計壓力 | 324 kPa-g (47 psig) |
| Normal P / T · 正常壓力／溫度 | ~0 psig / 49 °C (120 °F) |
| LOCA peak target · 失水峰值目標 | 415 kPa-g (~60 psig) |
| MSLB peak target · 蒸汽管峰值目標 | 350 kPa-g (~51 psig) |
| Pressurization τ · 增壓時間常數 | 8 s |
| Passive / fan / spray τ · 被動／風機／噴淋 τ | 300 s / 120 s / 30 s |
| Spray actuation delay · 噴淋啟動延遲 | 35 s (pump-start + valve-stroke) |
| Bistable deadband · 雙穩態死區 | 7 kPa (~1 psi) anti-chatter |
| LOCA source fade · 失水來源衰減 | × clamp(P_primary / 6 MPa) |
| Non-pressurizing accidents · 不增壓事故 | SGTR, out-of-containment breaks (bypass node) |

### Display · 顯示

Two new analogue gauges — **Containment pressure** (0–50 psig, design 47 psig; needle reddens at the 4-psig
Hi-1) and **Containment temperature** (100–300 °F) — plus three new annunciators: **CTMT PRESS HI**
（安全殼壓力高）, **CTMT ISOLATION**（安全殼隔離）and **CTMT SPRAY**（安全殼噴淋）. All strings bilingual via
the existing `Loc.I.Pick` pattern.

> _Screenshots skipped this run: the scheduled/unattended environment cannot grant computer-use capture and
> cannot navigate to the reactor page for a meaningful shot. Build verified green (0 errors); to be captured
> on a future interactive run._

---

## 2026-06-25 — RCP flow coastdown + buoyancy natural circulation (W ∝ Q^⅓) · 主泵流量惰轉＋浮力自然循環（W ∝ Q^⅓）

**Commit:** [`3189ced`](https://github.com/codingmachineedge/WinForge/commit/3189ced) on `feature/reactor-hyper`.

### What it models · 模擬內容

Primary loop flow used to follow a single symmetric first-order lag (`τ = 3 s` toward target) with a flat
`0.04` natural-circulation floor — pumps "spun down" as fast as they spun up, and the buoyancy floor was a
constant unrelated to power. Neither is physical. This run replaces both.

- **Per-loop, asymmetric pump dynamics.** Each of the four loops carries ¼ of rated flow and is integrated
  on its own. An **energised** pump relaxes toward its commanded share on a fast **1.5 s spin-up lag**.
- **Hyperbolic coastdown.** A **tripped** pump does *not* drop instantly — it coasts on flywheel + fluid
  rotational inertia along the real **G(t) = G₀ / (1 + t/τ½)** curve, **not** an exponential. Flow halves
  every **τ½ = 8 s**, then tails off slowly toward the natural-circulation floor. The RCP flywheel's high WR²
  deliberately stretches τ½ to preserve **DNBR margin** through the first seconds of a loss-of-flow. The
  update is the implicit form `G ← G / (1 + dt·ln2/τ½)` — unconditionally stable, monotone, always positive.
- **Buoyancy natural circulation.** With pumps gone the floor becomes a real single-phase thermosiphon
  scaling as the **cube root of core power**: driving head ∝ ρ·g·β·ΔT·H with ΔT = Q/(W·cp) and turbulent
  loop resistance ∝ W² ⇒ **W ∝ Q^(1/3)**. It is **gated** on a genuine hot-leg/cold-leg ΔT head *and* an
  intact SG heat sink (primary-to-secondary ΔT) — lose the secondary inventory and the thermosiphon stalls —
  and **capped at 8 % rated** (the physical single-phase ceiling). A `Thot > 100 °C` gate keeps a cold core
  from showing any phantom flow.
- **Emergent payoff.** Station-blackout, loss-of-feedwater and ATWS now show a *realistic* flow coastdown
  followed by a decaying natural-circulation tail that tracks decay heat (≈ 6 % right after a from-power trip,
  falling toward ~1 % over the following hour), instead of an instant step to a fixed 4 %.

一迴路流量原本只是單一對稱一階滯後（`τ = 3 秒` 趨向目標）加固定 `0.04` 自然循環地板——泵的「減速」與加速一樣快，
而浮力地板是與功率無關的常數，兩者皆不符物理。本次將其全部取代。

- **每迴路非對稱泵動態：** 四迴路各承擔額定流量 ¼，各自獨立積分。**通電**泵以較快的 **1.5 秒加速滯後** 趨向其指令份額。
- **雙曲線惰轉：** **跳脫**泵不會瞬間歸零——它依飛輪＋流體轉動慣性沿真實 **G(t) = G₀ /(1 + t/τ½)** 曲線惰轉
  （**非**指數）。流量每 **τ½ = 8 秒** 減半，再緩慢拖向自然循環地板。RCP 飛輪的高 WR² 刻意延長 τ½ 以在喪失流量
  最初數秒保住 **DNBR 裕度**。更新採隱式 `G ← G /(1 + dt·ln2/τ½)`——無條件穩定、單調、恆正。
- **浮力自然循環：** 泵全停後，地板變為真實單相熱虹吸，按**堆芯功率立方根**縮放：驅動水頭 ∝ ρ·g·β·ΔT·H，
  ΔT = Q/(W·cp)，紊流迴路阻力 ∝ W² ⇒ **W ∝ Q^(1/3)**。受真實冷熱腿 ΔT 水頭**與**完整蒸發器熱阱
  （一次對二次 ΔT）閘控——二次側存量喪失則熱虹吸停滯——並**上限 8% 額定**（單相物理天花板）。`Thot > 100 °C`
  閘控令冷堆芯不顯示任何虛假流量。
- **湧現效果：** 全廠斷電、喪失給水與未停堆暫態現在呈現*真實*的流量惰轉，隨後是追蹤衰變熱的自然循環衰減尾段
  （自功率跳脫後約 6%，其後一小時內降至約 1%），而非瞬間跳到固定 4%。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Coastdown form · 惰轉形式 | hyperbolic `G(t)=G₀/(1+t/τ½)`, **not** exponential |
| Flow-halving time τ½ · 流量減半時間 | **8 s** (W 4-loop w/ flywheel; real 3–10 s, plant-specific) |
| Pump spin-up lag · 泵加速滯後 | 1.5 s (first-order, energised on a live bus) |
| Per-loop rated share · 每迴路額定份額 | 0.25 (¼ of rated flow each) |
| Natural-circ scaling law · 自然循環縮放律 | **W ∝ Q^(1/3)** (turbulent loop resistance) |
| Natural-circ coefficient · 自然循環係數 | 0.16 · cbrt(P_fission+P_decay) |
| Natural-circ ceiling · 自然循環上限 | 8 % rated (single-phase) |
| Min ΔT to establish thermosiphon · 建立熱虹吸最小 ΔT | 8 °C (hot − cold leg) |
| Cold-core suppression gate · 冷堆芯抑制閘 | Thot > 100 °C |
| Stabilised natural circ · 穩定自然循環 | ~3–5 % rated; decay 6.5 % at trip → ~1 % at 1 h |
| Core ΔT under NC · 自然循環堆芯 ΔT | scales as Q^(2/3); can transiently approach full-power ΔT |

### Display · 顯示

The **RCP flow** gauge now annotates its reading with the active mode: **`· NAT CIRC` / `· 自然循環`** when
the buoyancy floor is governing flow, or **`· COASTDOWN` / `· 惰轉`** while a tripped pump is still carrying
inertial flow. New service properties `PumpedFlowFraction`, `NaturalCircFraction`, `RcpCoasting` and
`OnNaturalCirc` expose the forced-vs-buoyancy breakdown. · **主泵流量**錶現按使用中模式標註讀數：浮力地板主導
時顯示 **`· 自然循環`**，跳脫泵仍帶慣性流量時顯示 **`· 惰轉`**。

### Screenshots · 截圖

Skipped this run — the scheduled-run environment cannot grant interactive computer-use screenshot access, so
the freshly-built app was not launched/captured. The change is verified by a clean `dotnet build` (0 errors).
· 本次略過：排程環境無法授予互動式電腦操作截圖權限，故未啟動截取新建版本。改動已以乾淨建置（0 錯誤）驗證。

---

## 2026-06-25 — Pressurizer ASME code safety valves: three staggered pop valves above the PORV · 穩壓器 ASME 規範安全閥：PORV 之上三個錯位起跳彈簧閥

**Commit:** [`eb06679`](https://github.com/codingmachineedge/WinForge/commit/eb06679) on `feature/reactor-hyper`.

### What it models · 模擬內容

The sim already cycled a **PORV** (power-operated relief valve) at 2335 psig. Real Westinghouse 4-loop
plants sit a second, independent layer above it: **three spring-loaded ASME Section III code safety
valves** — self-actuated, *not* reclosable, the last-ditch RCS overpressure protection. This run adds them.

- **Pop-action, not modulating.** Each valve latches **fully open** the instant pressure exceeds its own
  set pressure (the simmer→pop→blowdown cycle of a real spring safety), and only **reseats** once pressure
  has fallen a full **blowdown band (~5 %, 0.86 MPa)** below that set. That open-vs-reseat **hysteresis** is
  what stops the valve chattering on/off at the fixed simulation timestep.
- **Staggered within tolerance.** The three setpoints are spread across the ±1 % as-found tolerance of the
  2485 psig nominal set (**17.18 / 17.24 / 17.30 MPa abs = 2477 / 2485 / 2494 psig**) so they don't all pop
  on the same step — the way a real valve bank lifts in sequence.
- **Choked-flow relief.** Once popped, combined relief scales with the **number of open valves** and a
  lift fraction that ramps with overpressure up to **+3 % accumulation (2560 psig / 17.75 MPa)** — the
  point of full lift, which keeps peak RCS pressure under the 110 %-design ASME service limit (2750 psia).
- **Staged ladder, PORV first.** Evaluated **after** the PORV each step, so the smaller, reclosable PORV
  stays the first responder; every safety **reseat point stays above PORV-close (16.06 MPa)** so the two
  layers never fight. Ideally the code safeties **never lift** in a well-controlled transient — they are
  not designed for frequent cycling, and a **stuck-open code safety behaves as a small-break LOCA** (the
  TMI-2 analog).

模擬原本已有一個 **PORV（電動釋壓閥）** 在 2335 psig 循環。真實西屋四迴路電廠在其之上設有第二、獨立的一層：
**三個彈簧式 ASME 第三章規範安全閥**——自驅動、**不可重關**，係 RCS 最後一道超壓保護。本次將其加入。
閥門為**彈跳式**（非調節式）：壓力一超過各自整定值即**全開**並鎖定，須待壓力跌落一個完整**洩放壓差（約 5 %，
0.86 MPa）**才**重座**，此開啟對重座**遲滯**避免在固定步長下抖動。三個整定點在 2485 psig 標稱值的 ±1 % 容差
內**錯位**（17.18／17.24／17.30 MPa 絕對），令其不會同一步起跳。起跳後總洩放量隨**開啟閥數**及隨超壓上升至
**+3 % 累積（2560 psig／17.75 MPa）** 的起跳分率而增。每步在 PORV **之後**評估，令較細、可重關的 PORV 維持
第一反應；所有重座點高於 PORV 關閉值（16.06 MPa），兩層互不干擾。理想情況下規範安全閥**永不起跳**——它們
並非為頻繁循環而設，而一個**卡開的規範安全閥等同小破口失水事故（LOCA）**（即 TMI-2 的類比）。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

Conversion: `MPa_abs = (psig + 14.7) / 145.038`.

| Parameter · 參數 | Value · 數值 |
|---|---|
| Number of code safety valves · 規範安全閥數目 | 3 (separate from the PORV) |
| Nominal set · 標稱整定 | 2485 psig ≈ 2500 psia = **17.24 MPa** (= RCS design pressure) |
| Valve #1 / #2 / #3 set · 各閥整定 | 17.18 / 17.24 / 17.30 MPa (2477 / 2485 / 2494 psig, ±1 % stagger) |
| Full lift (+3 % accumulation) · 全開（+3% 累積） | 2560 psig = **17.75 MPa** |
| Blowdown / reseat hysteresis · 洩放／重座遲滯 | ~5 % of set = **0.86 MPa** below each valve's own set |
| Per-valve relief rate at full lift · 各閥全開洩放率 | 4.0 MPa/s (> PORV's 2.5 MPa/s) |
| ASME service limit (peak transient) · ASME 使用限值 | 110 % design = 2750 psia |
| Overpressure ladder · 超壓階梯 (MPa abs) | spray 15.68 → PORV 16.20/close 16.06 → safeties 17.18/17.24/17.30 → full lift 17.75 |

### New API / annunciation · 新增介面／警示

- `PzrCodeSafetiesOpen` (int 0–3) and `AnyPzrCodeSafetyOpen` (bool) — live valve-lift state.
- `PzrCodeSafetyLifted` — a **rising-edge event** that fires once per individual pop; wired to an audible
  **relay-click "pop" cue** in the reactor page.
- **PZR SAFETY OPEN · 穩壓器安全閥起跳** annunciator tile lights whenever any safety is open.
- A sim **reset re-seats all three valves**.

### Screenshots · 截圖

Skipped this run — the scheduled-run environment cannot grant the computer-use screenshot capability, and
launching the freshly-built app unattended risks a stray process, so no panel capture was taken. The change
is verified by a clean `dotnet build` (0 errors). · 本次略過：排程環境無法授予 computer-use 截圖權限，且無人值守
下啟動程式有遺留行程風險，故未截取面板。改動已以乾淨建置（0 錯誤）驗證。

---

## 2026-06-25 — Turbine Electro-Hydraulic Control (EHC): governor valves, first-stage pressure, droop, OPC + overspeed trip · 汽輪機電液調速控制（EHC）：調速汽門、第一級壓力、下垂、OPC 連超速跳脫

**Commit:** [`e1ab89a`](https://github.com/codingmachineedge/WinForge/commit/e1ab89a) on `feature/reactor-hyper`.

### What it models · 模擬內容

The turbine was the last toy on the secondary side: the operator's load setpoint was applied **directly** as
steam draw and electrical output, with a cosmetic RPM lag. This run replaces it with a real **Electro-Hydraulic
Control (EHC / DEH)** governor, the way a Westinghouse/GE large nuclear set is actually driven:

- **Rate-limited load reference** — the operator demand (`Turbine load setpoint`) is no longer applied
  instantly. It feeds an internal **load reference** that ramps at the routine maneuvering rate **5 %rated/min
  up** and an asymmetric **20 %rated/min runback** down.
- **Governor-valve servo** — a first-order hydraulic actuator (**τ ≈ 0.5 s**) drives the actual **governor-valve
  position** toward the EHC command. Steam flow through the valve is `position × header-pressure factor`, so
  closing the GVs now **raises** steam-header pressure (the `SteamPressure` update was moved into the EHC block
  to keep a single writer).
- **Two control modes** — **pre-sync** the EHC does **speed control**, accelerating the shaft toward
  **1800 rpm** at ~**60 rpm/s** (~30 s roll) and holding; **post-sync** (breaker closed) it does **load
  control** with **5 % droop**, so the grid pins 1800 rpm and any overspeed excursion biases the valves shut.
- **First-stage (impulse-chamber) pressure** — a new calibrated **load signal**, linear in governor-valve steam
  flow (~**690 psia at 100 % load** on a ~1000 psia header). It now drives **electrical output**, the
  **three-element feedwater** steam-flow signal, and the **P-13** turbine-power permissive — replacing the old
  setpoint proxies with the *real* indicated load.
- **Overspeed protection** — the **Overspeed Protection Controller (OPC)** fast-closes the GVs at **103 %
  (1854 rpm)** (non-latching); a **mechanical/electronic overspeed trip** latches the stop valves shut at
  **110 % (1980 rpm)**. A **load rejection** (generator breaker opens while the GVs still admit steam) drives the
  unloaded shaft up toward ~2016 rpm, so OPC then the trip arrest it — **emergent**, not scripted.
- **P-9 anticipatory reactor trip** — a turbine trip **above 50 % power** now trips the reactor first (loss of
  the heat sink). Below P-9 the interlock is blocked and the plant rides the runback, as in a real plant.

### Key quantitative facts / setpoints · 主要量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Synchronous speed (4-pole, 60 Hz) · 同步轉速 | 1800 rpm = 100 % |
| Governor droop · 調速下垂 | 5 % (gain 1/droop = 20) |
| Load-reference ramp up · 負載參考升率 | 5 %rated/min |
| Load-reference runback (down) · 減負載率 | 20 %rated/min |
| Governor-valve servo lag · 調速汽門伺服延遲 | τ ≈ 0.5 s (first-order) |
| Rated first-stage pressure · 額定第一級壓力 | ≈ 690 psia @ 100 % load (~0.67 × header) |
| Pre-sync acceleration rate · 併網前加速率 | 60 rpm/s (~30 s to 1800 rpm) |
| OPC fast-close (non-latching) · OPC 快關（非閂鎖） | 103 % = 1854 rpm |
| Mechanical/electronic overspeed trip (latching) · 機械／電子超速跳脫（閂鎖） | 110 % = 1980 rpm |
| P-9 anticipatory reactor-trip-on-turbine-trip · P-9 汽輪機跳脫預期反應堆跳脫 | armed ≥ 50 % power |

### New operator controls & gauges · 新增操作員控制與儀表

- **First-stage press · 第一級壓力** gauge (psia) — the calibrated load indicator and P-13 source.
- **Governor valve · 調速汽門** gauge (% open) — shows GV throttling, OPC slam-shut and trip closure live.
- **Manual turbine trip · 手動汽輪機跳脫** button, and a **Reset turbine trip · 重置汽輪機跳脫** button that
  only re-opens the stop valves once the shaft has coasted below ~90 % speed (as on a real EHC latch).

### Numerical stability · 數值穩定性

Every new dynamic uses the engine's proven `x += (target − x)·min(1, dt/τ)` form (τ ≥ 0.5 s) plus the
asymmetric ramp limiter and hard [0,1] / RPM ≥ 0 clamps — unconditionally stable at the existing step, no new
stiff modes, single-writer discipline preserved for `SteamPressure` / `TurbineRPM` / `ElectricPowerMW`.

### Screenshots · 截圖

Skipped this run — computer-use screen capture cannot be granted in the unattended scheduled-run environment,
so the app was not launched (avoiding a stray process). The change is verified by a clean `dotnet build`
(0 errors). · 本次略過：排程無人值守環境無法授予畫面擷取，故不啟動程式（避免殘留程序）。改動已以乾淨建置
（0 錯誤）驗證。

---

## 2026-06-25 — Main Steam Line Break (MSLB) accident: overcooling, return-to-power, Lo-steamline-pressure SI + MSIV isolation · 主蒸汽管爆裂（MSLB）事故：過冷、返功率、蒸汽管低壓安全注入連主蒸汽隔離閥

**Commit:** [`ee30183`](https://github.com/codingmachineedge/WinForge/commit/ee30183) on `feature/reactor-hyper`.

### What it models · 模擬內容

The MSLB is the classic Westinghouse 4-loop design-basis accident that the sim was still missing — the
**thermodynamic inverse of the SGTR** already modelled. A rupture *downstream* of a steam generator vents
the secondary to atmosphere, so steam pressure crashes. Because the secondary **saturation temperature**
falls with it, the SG suddenly pulls heat from the primary far faster than the turbine ever did and the RCS
**overcools**. With the strongly-negative end-of-cycle **moderator temperature coefficient**, that cooldown
inserts **positive reactivity** — the design-basis **return-to-power** concern: a *tripped* core can be
driven back toward criticality. The plant's defence, also modelled, is the **Engineered Safety Features
Actuation System (ESFAS)**:

- **Faulted-SG blowdown** — a choked-flow surrogate (mass flux ∝ √P) relaxes the faulted-SG pressure toward
  a near-atmospheric floor with a severity-scaled time constant (~11 s at the default 0.7 severity). The
  collapsing `SecondarySatTemp()` widens the existing SG heat-removal term, plus a small **direct
  break-energy term** so the primary still overcools even with feedwater gone — the cooldown is **emergent**,
  not scripted.
- **Return-to-power is emergent** — no reactivity is hard-coded. The Tavg crash feeds the *existing*
  moderator-feedback term (≈ +20 pcm/°C); a ~100 °C cooldown is worth roughly **+2000 pcm**, enough to
  challenge shutdown margin on a tripped core.
- **Low-Steamline-Pressure Safety Injection** — a new **2-of-4** RPS/ESFAS function trips at **600 psia
  (4.14 MPa)**. It trips the reactor *and* actuates SI. It is **blocked by a P-11-style RCS-pressure
  permissive** (armed only above ~10 MPa) so the naturally-low secondary pressure during cold shutdown /
  heat-up cannot spuriously inject — exactly the manual low-pressure SI block operators insert for cooldown.
- **MSIV closure + borated SI** — on the SI signal the **main steam isolation valves auto-close**,
  terminating the blowdown (steam pressure then recovers through the existing lag and the overcooling
  stops), and **borated safety injection** ramps RCS boron toward **~2000 ppm** so the negative boron worth
  swamps the positive moderator reactivity. An operator **“Close MSIVs”** control lets you isolate manually,
  and **STEAMLINE BREAK** + **SAFETY INJECTION** annunciators were added.

MSLB 係模擬一直欠缺、屬經典西屋四環路設計基準事故——亦即已建模 SGTR 的**熱力學相反**。蒸發器**下游**破口令二
次側向大氣洩壓，蒸汽壓力急跌；二次側**飽和溫度**隨之下降，蒸發器從一次側抽熱遠快於汽輪機，一次側因而**過冷**。
配合壽期末強負**慢化劑溫度係數**，此過冷注入**正反應性**——即設計基準的**返功率**隱患：已**停堆**的爐心可被推
回臨界。電廠的防護（亦已建模）為**工程安全設施驅動系統（ESFAS）**：受損蒸發器以阻塞流近似（質量流量 ∝ √P）按
隨嚴重度縮放的時間常數（預設 0.7 時約 11 秒）洩向近大氣下限；`SecondarySatTemp()` 崩塌擴大原有蒸發器除熱項，
加細小**直接破口能量項**，即使失去給水仍過冷——過冷係**自然湧現**而非腳本。返功率亦**自然湧現**，無硬編碼反應
性：Tavg 急跌餵入**原有**慢化劑反饋（約 +20 pcm/°C），約 100 °C 過冷值約 **+2000 pcm**。新增**四取二**蒸汽管
低壓安全注入功能於 **600 psia（4.14 MPa）**跳脫，同時跳堆並啟動 SI，並受 **P-11 式一次側壓力允許訊號**封鎖（僅
約 10 MPa 以上解除），避免冷停機誤注入。SI 訊號令**主蒸汽隔離閥自動關閉**終止洩壓（蒸汽壓力隨延遲恢復、過冷停
止），並**含硼安注**將一次側硼濃度升至約 **2000 ppm**，負硼價壓過正慢化劑反應性。新增操作員**「關閉 MSIV」**控制
及 **STEAMLINE BREAK** 連 **SAFETY INJECTION** 警報。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| Lo-Steamline-Pressure SI setpoint · 蒸汽管低壓安全注入設定點 | **600 psia = 4.14 MPa**, 2-of-4 |
| SI permissive (P-11-style block) · 安注允許（P-11 式封鎖） | armed only when RCS ≥ 10 MPa |
| Faulted-SG blowdown time constant · 受損蒸發器洩壓時常數 | τ = 8.0 / severity s (≈11 s @ 0.7) |
| Blowdown pressure floor · 洩壓下限 | ~0.2 MPa (≈29 psia) |
| Break flow surrogate · 破口流量近似 | mass flux ∝ √P (choked) |
| Default break severity · 預設破口嚴重度 | 0.7 (0.3 small … 1.0 double-ended) |
| Moderator return-to-power worth · 慢化劑返功率價值 | ≈ +20 pcm/°C → ~+2000 pcm per 100 °C |
| Borated-SI boron target · 含硼安注硼濃度目標 | ~2000 ppm (ramps at 4 ppm/s) |
| Direct break-energy removal gain · 直接破口除熱增益 | 0.6 · W_break · max(0, Tavg − T_sat) |

### Emergent vs explicitly added · 自然湧現 vs 明確加入

- **Emergent** (no scripted physics): primary overcooling, the Tavg/Tcold crash, return-to-power via the
  existing moderator feedback, faulted-SG dryout, and the reactor scram itself. · **自然湧現**（無腳本物理）：
  一次側過冷、Tavg／Tcold 急跌、經原有慢化劑反饋的返功率、受損蒸發器枯乾、以及跳堆本身。
- **Explicitly added** (boundary conditions / actuation only): the break-severity latch and blowdown, the
  small direct break-energy term, the Lo-Steamline-Pressure SI function, MSIV-isolate latch, and the SI
  boron target. · **明確加入**（僅邊界條件／驅動）：破口嚴重度鎖存與洩壓、細小直接破口能量項、蒸汽管低壓安注
  功能、MSIV 隔離鎖存、安注硼濃度目標。

### New operator controls · 新增操作員控制

- **Scenario → “MSLB — main steam line break” · 情景 → 主蒸汽管爆裂**.
- **“Close MSIVs (isolate break)” · 「關閉主蒸汽隔離閥（隔離破口）」** toggle — manually isolate the break;
  SI also closes the MSIVs automatically.

### Screenshots · 截圖

Skipped this run. The freshly-built `feature/reactor-hyper` binary **does** launch (verified — a process
started and held a window), but the reactor panel could not be captured: this was an unattended scheduled
run, so the computer-use approval dialog could not be answered, and the dev-built `WinForge.exe` is not a
Start-menu-registered application the screenshot grant can resolve. The change is verified by a clean
`dotnet build` (0 errors) and the commit above. · 本次略過。新建 `feature/reactor-hyper` 程式**可**啟動（已
驗證——進程已啟動並持有視窗），但無法截取反應堆面板：本次為無人值守排程運行，電腦操作授權對話框無法回應，而
開發建置的 `WinForge.exe` 並非開始選單註冊的應用程式，截圖授權無法解析。改動已以乾淨建置（0 錯誤）及上述提交驗證。

---

## 2026-06-25 — Asymmetric Westinghouse f₁(ΔI) OTΔT penalty + CAOC out-of-band alarm · 非對稱西屋 f₁(ΔI) 超溫ΔT懲罰連 CAOC 超限警報

**Commit:** [`a4849aa`](https://github.com/codingmachineedge/WinForge/commit/a4849aa) on `feature/reactor-hyper` — refines the axial-flux work in [`bcac7a9`](https://github.com/codingmachineedge/WinForge/commit/bcac7a9) below.

### What it models · 模擬內容

The axial-flux entry below introduced the two-node ΔI/AO model and hooked an f₁(ΔI) penalty into the OTΔT
trip, but with a **symmetric ±5 % deadband placeholder** (the code comment flagged it as a stand-in). The
real Westinghouse **f₁(ΔI) is strongly asymmetric**, and the plant Technical Specifications constrain ΔI to
a power-dependent **CAOC target band**, not a fixed ±5 %. This run makes both real:

- **Asymmetric f₁(ΔI)** — the penalty deadband is now **−29 … +5 % ΔI**. A **bottom-peaked** core (negative
  ΔI) is tolerated over a wide range because the boiling margin is worst at the cooler core **inlet**; a
  **top-peaked** core (positive ΔI) is penalised with a **tight, steeper** leg because it pushes the
  DNB-limiting hot spot toward the saturated core **outlet**. Slopes: **0.015 ΔT₀ per %ΔI** on the negative
  leg, **0.025** on the positive leg (capped at 0.40 ΔT₀). This is the classic legacy 4-loop f₁ shape.
- **CAOC Technical-Specification target band (LCO 3.2.1 surrogate)** — ΔI is held near the all-rods-out
  equilibrium target **−5 % RTP**. The allowed half-width is **±5 % above 90 % power**, widening
  trapezoidally to **±15 % at 50 %** (axial xenon is easier to control at low flux), and the LCO is
  **inactive below 50 % RTP**.
- **`AFD OUT OF BAND` alarm · 軸向通量差超限** — a new annunciator asserts whenever, above 50 % power, ΔI
  leaves the power-dependent target band — the cue for the operator to restore axial shape before accruing
  Tech-Spec penalty minutes.

下方軸向通量條目已引入雙節點 ΔI/AO 模型並把 f₁(ΔI) 懲罰接入 OTΔT 跳脫，但只用**對稱 ±5 % 死區佔位**（代碼
註釋已標明屬暫代）。真實西屋 **f₁(ΔI) 高度非對稱**，技術規格亦以隨功率變化的 **CAOC 目標帶**約束 ΔI，而非固定
±5 %。本次將兩者做實：**非對稱 f₁(ΔI)** 死區改為 **−29 … +5 % ΔI**——下半尖峰（負 ΔI）因沸騰裕度最差處在較冷
的堆芯**入口**而可較大範圍容忍；上半尖峰（正 ΔI）因把偏離核沸騰熱點推向飽和的堆芯**出口**而以**又窄又陡**的支
懲罰；斜率負側 **0.015 ΔT₀／%ΔI**、正側 **0.025**（上限 0.40）。**CAOC 目標帶（LCO 3.2.1 代理）**：ΔI 維持於全
棒抽出平衡目標 **−5 % RTP**，90 % 功率以上半寬 **±5 %**，降到 50 % 時梯形擴至 **±15 %**，50 % 以下停用。新增
**AFD OUT OF BAND · 軸向通量差超限**警報：功率 50 % 以上 ΔI 一旦離開目標帶即報警，提示操作員恢復軸向形狀。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| f₁(ΔI) deadband · f₁(ΔI) 死區 | **−29 … +5 % ΔI** (asymmetric · 非對稱) |
| f₁ negative-leg slope · 負側斜率 | 0.015 ΔT₀ per %ΔI |
| f₁ positive-leg slope · 正側斜率 | 0.025 ΔT₀ per %ΔI |
| f₁ penalty cap · 懲罰上限 | 0.40 ΔT₀ |
| CAOC target ΔI · CAOC 目標 ΔI | −5 % RTP |
| Band half-width ≥ 90 % power · ≥90% 功率半寬 | ±5 % RTP |
| Band half-width at 50 % power · 50% 功率半寬 | ±15 % RTP (trapezoidal · 梯形) |
| LCO active above · LCO 生效功率 | 50 % RTP |
| New annunciator · 新增警報 | `AFD OUT OF BAND` · 軸向通量差超限 |

### Screenshots · 截圖

Skipped this run — as in prior runs the scheduled environment cannot launch the WinForge GUI (no matching
.NET runtime installed), and the f₁(ΔI) penalty / CAOC alarm only manifest when ΔI is driven out of band.
Verified instead by a clean `dotnet build WinForge.sln -c Debug -p:Platform=x64` (0 errors). · 本次略過：排程
環境無法啟動 GUI（未安裝對應 .NET 執行階段），且 f₁(ΔI) 懲罰／CAOC 警報只在 ΔI 超出目標帶時顯現。改以乾淨建置
（0 錯誤）驗證。

---

## 2026-06-25 — Axial flux difference (ΔI / axial offset) + CAOC band + f₁(ΔI) OTΔT penalty · 軸向通量差（ΔI／軸向偏移）連 CAOC 目標帶及 OTΔT 之 f₁(ΔI) 懲罰

**Commit:** [`bcac7a9`](https://github.com/codingmachineedge/WinForge/commit/bcac7a9) on `feature/reactor-hyper`

### What it models · 模擬內容

A real PWR core does **not** burn uniformly top-to-bottom: the axial power shape skews with control-rod
insertion, xenon redistribution and burnup. The plant measures this with two stacked ex-core power-range
detectors and watches two derived signals — **Axial Offset (AO)** and **Axial Flux Difference (ΔI)** — and
the **OTΔT** anti-DNB reactor trip subtracts an **f₁(ΔI) penalty** when the flux skews too far, because an
axially-peaked core hits the DNB limit at a lower ΔT. Until this run the sim had **no axial dimension at
all** and its OTΔT setpoint was missing the f₁(ΔI) term.

This run adds a lumped **two-node (top / bottom) axial model**:

- **ΔI / AO from rod insertion** — the lead control bank (D) enters from the **top**, so insertion past its
  steady ~5 % HFP bite drives the shape **bottom-peaked** → AO and ΔI go **negative**. A stable first-order
  lag (τ = 4 s) keeps the prompt response smooth.
- **Axial xenon** — iodine/xenon are now split per node (production weighted by node power); the
  **top-minus-bottom Xe-135 difference** feeds a second shape term, so a rod/load change seeds the slow
  axial-xenon swing. The node **mean** is written back to the scalar poison, so the global xenon reactivity
  is **byte-for-byte unchanged** — only the new top/bottom *difference* drives the shape.
- **f₁(ΔI) penalty on OTΔT** — zero inside the **CAOC deadband (±5 % RTP)**, then reduces the allowable ΔT
  setpoint at **0.025 ΔT₀ per %ΔI** (capped at 0.40), exactly the Westinghouse functional form, so a skewed
  core challenges the OTΔT trip sooner.
- **New AFD gauge** — shows ΔI in % RTP and AO in %, with the CAOC operating band (green ±5 %, amber to
  ±15 %, red beyond) — the band where the operator must keep ΔI.

真實壓水堆堆芯上下並非均勻燃燒：軸向功率形狀隨控制棒插入、氙再分布同燃耗而偏斜。電廠以兩個上下疊放的堆外
功率量程探測器量度，監視**軸向偏移（AO）**同**軸向通量差（ΔI）**兩個訊號；當通量過度偏斜時，**OTΔT**防偏離核
沸騰跳脫會扣減一個 **f₁(ΔI) 懲罰**，因為軸向尖峰堆芯會在較低 ΔT 即達 DNB 極限。本次之前模擬**完全冇軸向維度**，
OTΔT 設定點亦缺 f₁(ΔI) 項。本次加入集總**雙節點（上／下）軸向模型**：控制棒 D 組由頂部進入，插入超過約 5 %
高功率咬入即令形狀**下半尖峰**，AO 同 ΔI 轉**負**，並經 4 秒一階滯後平滑；碘／氙按節點功率分拆，**上下 Xe-135
差**驅動第二形狀項，節點平均值寫返純量令全局氙毒反應性不變；OTΔT 在 **CAOC 死區 ±5 %RTP** 內無懲罰，之後以
**每 %ΔI 0.025 ΔT₀**（上限 0.40）扣減；新增軸向通量差儀表顯示 ΔI 同 AO 連 CAOC 目標帶。

### Key quantitative facts · 關鍵量化數據

| Quantity · 量 | Value · 數值 |
|---|---|
| AO definition | (P_top − P_bot) / (P_top + P_bot) × 100 % |
| ΔI definition | (P_top − P_bot) × 30 %RTP full-scale × power fraction |
| CAOC target deadband | ±5 % RTP (no OTΔT penalty inside) |
| f₁(ΔI) slope | 0.025 ΔT₀ per %ΔI beyond deadband (≈ 2.5 %ΔT₀/%ΔI), capped 0.40 |
| ΔT₀ (full-power ΔT) | 60 °F |
| Lead-bank D HFP bite | ~5 % inserted (neutral axial reference) |
| Axial lag τ | 4 s |
| Sanity: HFP rods at band | ΔI ≈ −0.6 %, no penalty (in deadband) |
| Sanity: bank D ~50 % in | ΔI ≈ −8 %, f₁ ≈ 0.085 → OTΔT setpoint −5 °F |

*Deadband edges, slope, full-scale and the target-AO line are COLR/cycle-specific in a real plant; the values
above are representative Westinghouse 4-loop figures. Real f₁(ΔI) is asymmetric (~−29/+5 %ΔI); a symmetric
±5 % band is used here for a clean CAOC demo.*

### Files · 檔案

`Services/ReactorSimService.cs` (two-node split in `StepKineticsAndThermal`, per-node I/Xe in `UpdateXenon`,
f₁(ΔI) in `BuildRps`), `Services/ReactorScenarios.cs` (`"afd"` gauge spec), `Pages/ReactorModule.xaml.cs`
(AFD gauge).

---

## 2026-06-25 — Three-element SG feedwater level control + shrink/swell · 三元蒸發器給水水位控制連縮脹反應

**Commit:** [`c00fbc5`](https://github.com/codingmachineedge/WinForge/commit/c00fbc5) on `feature/reactor-hyper`

### What it models · 模擬內容

A real steam-generator (SG) narrow-range (NR) level transmitter measures the height of the **two-phase
swell**, not pure liquid inventory. So on a load **increase** (more steaming, falling SG pressure) the
voids expand and the indicated level momentarily **swells up** even though mass is draining; on a load
**rejection** it **shrinks**. A level-only controller reacts backwards to that — which is exactly why the
real plant uses **three-element control** (level + steam flow + feed flow) above ~18 % power.

This run replaces the old crude algebraic level target with:

- **True integrating inventory** — SG level is now the time-integral of (feedwater − steam flow), because
  an SG *is* an integrator. Three-element control only makes physical sense against an integrating plant.
- **Three-element controller** — a master level-PI, **steam-flow feedforward** (feed tracks steam demand
  promptly, before the level error develops), and a **feed-reg-valve** first-order inner lag (~4 s stroke).
- **Single-element fallback** — below 18 % power (hysteresis back to 16 %) the dP-based steam/feed flow
  signals (∝ √dP, only ~1 % of span at 10 % flow) are too noisy, so control falls back to **level-only**
  on the low-load valve, with bumpless transfer.
- **Shrink/swell** — the indicated NR level carries a washed-out void transient: a high-pass of steam flow
  (12 s relaxation, clamped ±15 % NR). The **gauge and the 17 % low-low reactor-trip + AFW** both act on
  this **indicated** level, like real transmitters — so a load-rejection shrink can genuinely challenge the
  trip setpoint, the classic spurious-trip path the three-element scheme exists to tame.

真實蒸汽發生器窄域水位變送器量度的是**兩相膨脹**高度，而非純液體存量。故升載（蒸汽增加、壓力下降）時空泡
膨脹，指示水位短暫**脹升**，即使質量正在流失；甩載時則**縮降**。純水位控制器會反向動作——這正是真實電廠在
約 18 % 功率以上採用**三元控制**（水位＋蒸汽流量＋給水流量）的原因。本次以下列取代舊有粗略代數目標：真正
**積分式存量**（水位 = ∫(給水−蒸汽)）、**三元控制器**（主水位 PI＋蒸汽流量前饋＋給水調節閥內環延遲）、
18 % 以下的**單元（純水位）後備**控制（差壓流量訊號低功率不可靠），以及**縮脹效應**（指示窄域水位帶經高通
濾波的空泡暫態，12 秒鬆弛、±15 %）。儀表與 17 % 低低跳脫＋輔助給水均依此**指示**水位動作，與真實變送器一致。

### Key quantitative facts / setpoints · 關鍵量化數據／設定點

| Parameter · 參數 | Value · 數值 |
|---|---|
| NR level program setpoint · 窄域水位程式設定點 | 33 % NR (low power) → 50 % NR (HFP) |
| Single↔three-element transfer · 單元↔三元切換 | 18 % power (16 % hysteresis) |
| Low-low SG level reactor trip + AFW · 蒸發器低低水位跳脫＋輔助給水 | 17 % NR (on **indicated** level) |
| Feed-reg-valve stroke lag · 給水調節閥行程延遲 | ~4 s (first-order) |
| Steam-flow transmitter lag · 蒸汽流量變送器延遲 | ~1 s |
| Shrink/swell washout time constant · 縮脹washout 時常數 | 12 s |
| Shrink/swell magnitude clamp · 縮脹幅度限值 | ±15 % NR |
| Master level-PI gains · 主水位 PI 增益 | Kp 0.020 /%, Ki 0.004 /%·s |
| AFW floor on feed loss · 失水時輔助給水下限 | 0.15 (≈ decay-heat duty) |

### New operator controls · 新增操作員控制

- **Feedwater AUTO · 給水自動** toggle (default **ON**) — the three-element controller regulates level to
  the program setpoint. Turn it **off** to hand `Feedwater flow` back to the manual slider.
- The SG-level gauge now reads **indicated** NR level (inventory + shrink/swell), so swell/shrink transients
  are visible during load changes and trips.

### Screenshots · 截圖

Skipped this run — the build targets `net11.0` and the matching .NET runtime is not installed in the
scheduled-run environment, so the app could not be launched to capture the reactor panel. The change is
verified by a clean `dotnet build` (0 errors). · 本次略過：建置目標為 `net11.0`，排程環境未安裝對應 .NET
執行階段，無法啟動程式截取面板。改動已以乾淨建置（0 錯誤）驗證。

---

_Part of the [Home](app-doc://article/winforge.wiki.355883cf07556dda) · WinForge wiki. The reactor lives on `feature/reactor-hyper`._
