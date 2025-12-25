Merezhyvo. Color scheme. 

----

Dark theme.

Note: the hex values below are approximate. They were inferred visually from the screenshots and may vary slightly depending on device gamma, scaling, and blur/transparency effects.

1.  Overall look & feel
    

*   The dark theme is “deep navy at night”: very dark blue backgrounds with slightly lighter elevated surfaces.
    
*   UI surfaces often use a glassy / frosted feel (blurred content behind), with soft borders instead of heavy shadows.
    
*   Important states are communicated with clean accent outlines (blue / amber / red) rather than big filled warning blocks.
    

2.  Core neutrals (backgrounds & surfaces)  
    A. App chrome (top bar / window frame)
    

*   Top bar background: near charcoal navy, around #1C1F27.
    
*   Icons in the top bar are light and high-contrast (white/very light gray), with subtle “inactive” dimming.
    

B. Main background (behind pages and modals)

*   Base background: very dark navy, around #0F1525.
    
*   The background often looks like a subtle vertical gradient (slightly lighter toward the center, darker toward edges).
    

C. Elevated surfaces (panels, dialogs, sheets)

*   Main modal/panel surface: deep navy in the range #0E1629 to #131B2D.
    
*   Panels are clearly separated from the background mostly by:
    
    *   brighter surface tone (not much brighter, but noticeable),
        
    *   rounded corners,
        
    *   soft outline/border.
        

D. Borders & separators

*   Default borders are subtle and cool-toned (blue-gray). Think “thin and quiet”.
    
*   Dividers in lists are low-contrast lines (a faint blue-gray rather than pure gray).
    

3.  Text colors
    

*   Primary text (titles, main labels): near-white with a cool tint (reads as “white”, not warm). Approx range: #EAF0FF–#F5F7FF.
    
*   Secondary text (descriptions/subtitles): light gray-blue, approx #B9C3D8.
    
*   Tertiary/muted text (meta, timestamps, less important hints): mid gray-blue, approx #7F8AA3.
    
*   Disabled text: darker, washed-out gray-blue (below muted).
    

4.  Accent & semantic colors  
    A. Primary accent (blue)  
    Used for: toggles ON, focus/active indicators, thin scrollbars, interactive emphasis.
    

*   Primary blue (UI accent): approx #235CDC to #3472D6.
    
*   Link blue (lighter, more “neon”): approx #8CBBF1 (often underlined).
    

B. Warning accent (amber/gold)  
Used for: “Heads up” notes, exception-enabled state highlights, attention without “danger”.

*   Warning gold: approx #B48D25.  
    This is used as text color and as an outline/highlight around cards when a site has an exception enabled.
    

C. Danger / critical (red)  
Used for: certificate problems, “unsafe” states, destructive/critical action emphasis.

*   Red in the screenshots reads as a muted coral red (not a pure neon red). Use a restrained red that stays readable on navy. (Approx target: around #D05A5A, with darker variants for borders and brighter variants for text/icons.)
    

5.  Component-level behavior
    

A. Address bar

*   Address field background is slightly lighter than the top bar, helping it read as an input “pill”.
    
*   Secure state uses a calm icon treatment; insecure/certificate issues switch to danger semantics in the site security panel rather than repainting the whole chrome.
    

B. Floating “Site security” panel

*   Panel background: elevated surface navy (#0E1629–#131B2D).
    
*   Rows are “cards inside a card”: each row has its own subtle boundary.
    
*   State is communicated per row:
    
    *   Normal: neutral styling.
        
    *   Exception enabled: amber outline and amber-tinted emphasis.
        
    *   Certificate problem: red outline and red-tinted emphasis.
        
*   Structure is consistent: left icon, main label, short status line, chevron on the right.
    

C. Buttons (dialog actions)

*   Buttons are mostly outline-based on dark backgrounds.
    
*   Cancel/neutral actions use the primary blue outline.
    
*   Risky/override actions use the danger red outline.
    
*   Filled buttons appear rarely; when they do (e.g., “Sign in” pill), they’re light and friendly, not aggressive.
    

D. Toggles / switches

*   OFF: blends into the surface (dark track), low emphasis.
    
*   ON: blue track with a white knob. The blue is the same primary accent family (#235CDC–#3472D6).
    
*   The theme relies on the ON color to signal “enabled”, without adding extra glow effects.
    

E. Links

*   Links are clearly “link-blue” and underlined (high clarity on dark background).
    
*   Link blue is noticeably lighter than the primary toggle blue (approx #8CBBF1), improving discoverability in settings screens.
    

F. Lists (History, Tabs, Exceptions)

*   List items are separated by subtle dividers and spacing rather than heavy borders.
    
*   Selected/pinned items use a gentle blue-tinted highlight background (a “quiet selection”, not a saturated fill).
    
*   Icons (favicons) add color, but the UI itself stays restrained.
    

G. Scrollbars

*   Thin, high-visibility blue scrollbar indicator on dark surfaces (accent blue family, often close to #3472D6).
    
*   Track is barely visible; the thumb/indicator is what stands out.
    

6.  Practical palette (suggested tokens)  
    Neutrals
    

*   Chrome / top bar: ~#1C1F27
    
*   Base background: ~#0F1525
    
*   Elevated surface: ~#0E1629 to ~#131B2D
    
*   Divider/border (subtle): dark blue-gray (keep low contrast)
    

Text

*   Text primary: ~#EAF0FF
    
*   Text secondary: ~#B9C3D8
    
*   Text muted: ~#7F8AA3
    

Accents

*   Accent primary (blue): ~#235CDC / ~#3472D6
    
*   Link (light blue): ~#8CBBF1
    
*   Warning (gold): ~#B48D25
    
*   Danger (coral red): target a muted red in the ~#D05A5A range
    

7.  Key theme rules to keep consistency
    

*   Don’t use pure black; always prefer navy/charcoal to keep the UI “soft”.
    
*   Prefer outlines + subtle tints for states; avoid large saturated fills.
    
*   Keep warning text gold (not neon yellow) and danger red muted (not screaming).
    
*   Reserve the bright light-blue for links and “active UI indicators” (like the scrollbar), so it stays meaningful.

----

Light theme.

1.  Overall look & feel
    

*   Light theme should feel “cool and airy”, not stark white.
    
*   Base surfaces are off-white with a subtle blue/gray tint (to match the dark theme’s navy DNA).
    
*   Elevation is primarily communicated by soft borders + gentle background shift (not heavy shadows).
    
*   State communication stays consistent: outlines and small semantic accents, not loud filled banners.
    

2.  Core neutrals (backgrounds & surfaces)  
    A. App chrome (top bar / window frame)
    

*   Top bar background: cool light gray-blue, not pure white.
    
    *   Suggested: #EEF2F8
        
*   Optional subtle bottom divider: #D6DDEA
    

B. Main background (behind pages and modals)

*   Base background: very light cool blue-gray.
    
    *   Suggested: #F6F8FC
        
*   Optional gentle gradient: slightly darker near edges to add depth without shadows.
    

C. Elevated surfaces (panels, dialogs, sheets)

*   Main surface: white with a cool tint.
    
    *   Suggested: #FFFFFF (or #FAFCFF if you want it softer)
        
*   Secondary surface (cards inside panels): slightly tinted.
    
    *   Suggested: #F2F6FC
        
*   Borders define the component structure:
    
    *   Default border: #D6DDEA
        
    *   Stronger border for “card inside card”: #CBD5E4
        

D. Dividers & separators

*   List dividers: #E2E8F3 (low contrast but clearly visible).
    
*   Avoid pure neutral grays; keep everything slightly blue-leaning.
    

3.  Text colors
    

*   Primary text: deep navy (same family as dark theme background).
    
    *   Suggested: #0F1525
        
*   Secondary text: cool slate.
    
    *   Suggested: #3B4A66
        
*   Muted text: desaturated blue-gray.
    
    *   Suggested: #6B7A96
        
*   Disabled text: #95A2B8
    

4.  Accent & semantic colors  
    Keep the same semantic “roles” as dark theme; only adjust brightness/saturation for light backgrounds.
    

A. Primary accent (blue)  
Used for: toggles ON, focus rings, active states, scrollbar thumb, primary outlines.

*   Primary blue: #235CDC (keep brand-consistent)
    
*   Hover/active variants:
    
    *   Hover: #1F52C8
        
    *   Subtle tint background (selection/highlight): #E6EEFF
        

B. Link color

*   Link blue: slightly deeper than on dark theme (for contrast on light).
    
    *   Suggested: #1F5FD9
        
*   Underline links by default in settings/help areas (keeps the current “clear link” behavior).
    

C. Warning (gold)  
Used for: “Heads up”, exception-enabled highlights.

*   Gold text/border: #B48D25 (same family)
    
*   Warning tint background: #FFF6DE (very light, optional and used sparingly)
    

D. Danger (red)  
Used for: certificate problems, destructive actions.

*   Coral red (muted): #C94B4B
    
*   Danger tint background: #FFE8E8 (very light, optional and used sparingly)
    

5.  Component-level behavior
    

A. Address bar

*   Address field background: slightly tinted surface so it reads as an input, not a flat white strip.
    
    *   Suggested background: #F2F6FC
        
    *   Border: #CBD5E4
        
*   Focus ring: 2px in primary blue (#235CDC) or an outer glow using tint #E6EEFF.
    

B. Floating “Site security” panel

*   Panel surface: #FFFFFF
    
*   Panel border: #CBD5E4
    
*   Rows (“cards inside a card”):
    
    *   Background: #F6F8FC or #F2F6FC
        
    *   Border: #D6DDEA
        
*   State styling (match dark theme logic):
    
    *   Normal: neutral border.
        
    *   Exception enabled: gold outline/border + gold icon/text accent, optional very light gold tint.
        
    *   Certificate problem: red outline/border + red icon/text accent, optional very light red tint.
        
*   Keep chevrons and secondary statuses in muted text.
    

C. Buttons (dialog actions)  
Keep the dark theme’s “outline-first” personality.

*   Neutral/secondary button:
    
    *   Text: #235CDC
        
    *   Border: #235CDC
        
    *   Background: transparent
        
    *   Hover background: #E6EEFF
        
*   Primary action (when needed):
    
    *   Background: #235CDC
        
    *   Text: white
        
    *   Hover: #1F52C8
        
*   Destructive/override:
    
    *   Outline style by default (to avoid scary solid red everywhere)
        
    *   Border/text: #C94B4B
        
    *   Hover background: #FFE8E8
        

D. Toggles / switches

*   OFF:
    
    *   Track: #D6DDEA
        
    *   Knob: #FFFFFF with subtle border #CBD5E4
        
*   ON:
    
    *   Track: #235CDC
        
    *   Knob: #FFFFFF
        
*   Keep the same geometry and motion as dark theme for continuity.
    

E. Links

*   Use link blue (#1F5FD9) with underline.
    
*   On hover: slightly darker (#1B52C2) or add subtle underline thickness.
    

F. Lists (History, Tabs, Exceptions)

*   List background: base background (#F6F8FC)
    
*   Item background: surface (#FFFFFF), or alternating very subtle tint (#FAFCFF)
    
*   Selected/pinned item:
    
    *   Background: #E6EEFF (subtle blue tint)
        
    *   Border or left indicator: #235CDC
        
*   Keep the same spacing rhythm and rounded corners as dark theme.
    

G. Scrollbars

*   Track: transparent or #F2F6FC (barely visible)
    
*   Thumb: #3472D6 or #235CDC (use the same family as dark theme)
    
*   Hover thumb: #1F52C8
    

6.  Practical palette (suggested tokens)  
    Neutrals
    

*   Chrome / top bar: #EEF2F8
    
*   Base background: #F6F8FC
    
*   Surface: #FFFFFF (or #FAFCFF)
    
*   Surface alt: #F2F6FC
    
*   Border: #D6DDEA
    
*   Border strong: #CBD5E4
    
*   Divider: #E2E8F3
    

Text

*   Text primary: #0F1525
    
*   Text secondary: #3B4A66
    
*   Text muted: #6B7A96
    
*   Text disabled: #95A2B8
    

Accents

*   Accent blue: #235CDC
    
*   Accent blue hover: #1F52C8
    
*   Accent tint bg: #E6EEFF
    
*   Link: #1F5FD9
    
*   Warning: #B48D25
    
*   Warning tint: #FFF6DE
    
*   Danger: #C94B4B
    
*   Danger tint: #FFE8E8
    

7.  Key theme rules to keep the “same product” feeling
    

*   No pure whites everywhere: always keep a cool tint in backgrounds and borders.
    
*   Keep the outline-first, minimal look: states are mostly outlines + icon/text color.
    
*   Use semantic tint backgrounds only when it improves readability (and keep them very light).
    
*   Preserve the same component shapes, spacing, and hierarchy as dark theme.
    
*   Keep the same accent blue family so UI feels identical across themes.
    


----


Mapping table:

## 1) Neutrals: backgrounds & surfaces

*   **chrome.bg (top bar)**
    
    *   Dark: ~#1C1F27
        
    *   Light: **#EEF2F8**
        
*   **app.bg (page background)**
    
    *   Dark: ~#0F1525
        
    *   Light: **#F6F8FC**
        
*   **surface.1 (panel / modal surface)**
    
    *   Dark: ~#0E1629–#131B2D
        
    *   Light: **#FFFFFF** (або #FAFCFF для “м’якше”)
        
*   **surface.2 (inner cards / secondary surfaces)**
    
    *   Dark: “slightly lighter than surface.1” (same navy family)
        
    *   Light: **#F2F6FC**
        
*   **border.default (subtle borders)**
    
    *   Dark: low-contrast blue-gray (subtle)
        
    *   Light: **#D6DDEA**
        
*   **border.strong (card-in-card, focused containers)**
    
    *   Dark: slightly stronger than border.default
        
    *   Light: **#CBD5E4**
        
*   **divider.list (row separators)**
    
    *   Dark: faint blue-gray
        
    *   Light: **#E2E8F3**
        

## 2) Typography: text

*   **text.primary**
    
    *   Dark: ~#EAF0FF–#F5F7FF
        
    *   Light: **#0F1525**
        
*   **text.secondary**
    
    *   Dark: ~#B9C3D8
        
    *   Light: **#3B4A66**
        
*   **text.muted**
    
    *   Dark: ~#7F8AA3
        
    *   Light: **#6B7A96**
        
*   **text.disabled**
    
    *   Dark: darker washed-out gray-blue
        
    *   Light: **#95A2B8**
        

## 3) Brand / interaction accents

*   **accent.primary (blue)**
    
    *   Dark: ~#235CDC / ~#3472D6
        
    *   Light: **#235CDC** (same brand anchor)
        
*   **accent.primary.hover**
    
    *   Dark: darker/stronger variant of blue
        
    *   Light: **#1F52C8**
        
*   **accent.tint.bg (selection / subtle highlight fill)**
    
    *   Dark: subtle blue-tinted highlight on navy
        
    *   Light: **#E6EEFF**
        
*   **link**
    
    *   Dark: ~#8CBBF1 (underlined)
        
    *   Light: **#1F5FD9** (underlined)
        
*   **scrollbar.thumb**
    
    *   Dark: often close to ~#3472D6
        
    *   Light: **#235CDC** (or #3472D6, якщо хочеш більш “помітно”)
        

## 4) Semantics: warning & danger

*   **warning**
    
    *   Dark: ~#B48D25
        
    *   Light: **#B48D25** (same family)
        
*   **warning.tint.bg (optional)**
    
    *   Dark: usually none / very subtle
        
    *   Light: **#FFF6DE**
        
*   **danger**
    
    *   Dark: muted coral-red (~#D05A5A range)
        
    *   Light: **#C94B4B**
        
*   **danger.tint.bg (optional)**
    
    *   Dark: usually none / very subtle
        
    *   Light: **#FFE8E8**
        

## 5) Controls: buttons, inputs, toggles (behavior mapping)

*   **button.secondary (outline-first)**
    
    *   Dark: outline blue on dark surface
        
    *   Light: outline blue on light surface
        
    *   Light tokens:
        
        *   text/border: **#235CDC**
            
        *   hover bg: **#E6EEFF**
            
*   **button.primary (filled, rare)**
    
    *   Dark: filled blue + white text
        
    *   Light: filled blue + white text
        
    *   Light tokens:
        
        *   bg: **#235CDC**
            
        *   hover bg: **#1F52C8**
            
        *   text: **#FFFFFF**
            
*   **button.danger (prefer outline)**
    
    *   Dark: red outline + minimal fill
        
    *   Light: red outline + minimal fill
        
    *   Light tokens:
        
        *   text/border: **#C94B4B**
            
        *   hover bg: **#FFE8E8**
            
*   **input.bg (address bar / fields)**
    
    *   Dark: slightly lighter than chrome
        
    *   Light: slightly darker than base bg
        
    *   Light tokens:
        
        *   bg: **#F2F6FC**
            
        *   border: **#CBD5E4**
            
*   **focus.ring**
    
    *   Dark: primary blue focus outline
        
    *   Light: primary blue focus outline
        
    *   Light: **#235CDC** (2px)
        
*   **toggle.off.track**
    
    *   Dark: blends into surface (low emphasis)
        
    *   Light: **#D6DDEA**
        
*   **toggle.on.track**
    
    *   Dark: accent blue
        
    *   Light: **#235CDC**
        
*   **toggle.knob**
    
    *   Dark: near-white
        
    *   Light: **#FFFFFF** (+ optional border #CBD5E4 when OFF)
        

## 6) Site security panel states (direct mapping)

*   **panel.bg**
    
    *   Dark: surface.1 navy
        
    *   Light: **#FFFFFF**
        
*   **row.bg**
    
    *   Dark: slightly lighter navy blocks
        
    *   Light: **#F2F6FC** (or #F6F8FC)
        
*   **state.normal.border**
    
    *   Dark: subtle border
        
    *   Light: **#D6DDEA**
        
*   **state.exception.border (warning)**
    
    *   Dark: warning outline
        
    *   Light: **#B48D25** (+ optional bg #FFF6DE)
        
*   **state.problem.border (danger)**
    
    *   Dark: danger outline
        
    *   Light: **#C94B4B** (+ optional bg #FFE8E8)
        
