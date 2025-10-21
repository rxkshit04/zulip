import $ from "jquery";

import * as util from "./util.ts";

function mark_animating($spoiler: JQuery, animating: boolean): void {
    if (animating) {
        $spoiler.addClass("spoiler-animating");
    } else {
        $spoiler.removeClass("spoiler-animating");
    }
}

function is_animating($spoiler: JQuery): boolean {
    return $spoiler.hasClass("spoiler-animating");
}

function collapse_spoiler($spoiler: JQuery): void {
    const spoiler_height = $spoiler.height() ?? 0;

    // Set height to rendered height on next frame, then to zero on following
    // frame to allow CSS transition animation to work
    // Also mark the spoiler as animating to guard against rapid clicks
    mark_animating($spoiler, true);

    // Ensure we clean up the animating state when the height transition ends
    $spoiler.on("transitionend", (e) => {
        // Only handle the height property's transition end; other properties
        // like border and padding also transition.
        const originalEvent = (e as unknown as {originalEvent?: {propertyName?: string}})
            .originalEvent;
        const propertyName = originalEvent?.propertyName ?? "";
        if (propertyName !== "height") {
            return;
        }
        mark_animating($spoiler, false);
        $spoiler.off("transitionend");
    });

    requestAnimationFrame(() => {
        $spoiler.height(`${spoiler_height}px`);
        $spoiler.removeClass("spoiler-content-open");

        requestAnimationFrame(() => {
            $spoiler.height("0px");
        });
    });
}

function expand_spoiler($spoiler: JQuery): void {
    // Normally, the height of the spoiler block is not defined absolutely on
    // the `spoiler-content-open` class, but just set to `auto` (i.e. the height
    // of the content). CSS animations do not work with properties set to
    // `auto`, so we get the actual height of the content here and temporarily
    // put it explicitly on the element styling to allow the transition to work.
    const spoiler_height = util.the($spoiler).scrollHeight;
    $spoiler.height(`${spoiler_height}px`);
    // The `spoiler-content-open` class has CSS animations defined on it which
    // will trigger on the frame after this class change.
    $spoiler.addClass("spoiler-content-open");

    // Mark animating and clean up when the height transition completes
    mark_animating($spoiler, true);
    $spoiler.on("transitionend", (e) => {
        const originalEvent = (e as unknown as {originalEvent?: {propertyName?: string}})
            .originalEvent;
        const propertyName = originalEvent?.propertyName ?? "";
        if (propertyName !== "height") {
            return;
        }
        // When the CSS transition is over, reset the height to auto
        // This keeps things working if, e.g., the viewport is resized
        $spoiler.height("");
        mark_animating($spoiler, false);
        $spoiler.off("transitionend");
    });
}

export const hide_spoilers_in_notification = ($content: JQuery): JQuery => {
    $content.find(".spoiler-block").each((_i, elem) => {
        $(elem).find(".spoiler-content").remove();
        let text = $(elem).find(".spoiler-header").text().trim();
        if (text.length > 0) {
            text = `${text} `;
        }
        text = `${text}(…)`;
        $(elem).find(".spoiler-header").text(text);
    });
    return $content;
};

export function initialize(): void {
    $("body").on("click", ".spoiler-header", function (this: HTMLElement, e) {
        const $button = $(this).children(".spoiler-button");
        const $arrow = $button.children(".spoiler-arrow");
        const $spoiler_content = $(this).siblings(".spoiler-content");
        const $target = $(e.target);

        // Spoiler headers can contain Markdown, including links.  We
        // return so that clicking such links will be processed by
        // the browser rather than opening the header.
        if ($target.closest("a").length > 0) {
            return;
        }

        // Allow selecting text inside a spoiler header, but only if the selection
        // is within the header. If there's a selection elsewhere, treat this as a
        // normal click (i.e., toggle the spoiler).
        const selection = document.getSelection();
        if (selection && selection.type === "Range") {
            const anchorInHeader = selection.anchorNode !== null && this.contains(selection.anchorNode);
            const focusInHeader = selection.focusNode !== null && this.contains(selection.focusNode);
            if (anchorInHeader || focusInHeader) {
                return;
            }
        }

        // Prevent toggling while the open/close transition is in progress to avoid
        // inconsistent UI states from rapid clicks.
        if (is_animating($spoiler_content)) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        if ($spoiler_content.hasClass("spoiler-content-open")) {
            // Content was open, we are collapsing
            $arrow.removeClass("spoiler-button-open");

            // Modify ARIA roles for screen readers
            $button.attr("aria-expanded", "false");
            $spoiler_content.attr("aria-hidden", "true");

            collapse_spoiler($spoiler_content);
        } else {
            // Content was closed, we are expanding
            $arrow.addClass("spoiler-button-open");

            // Modify ARIA roles for screen readers
            $button.attr("aria-expanded", "true");
            $spoiler_content.attr("aria-hidden", "false");

            expand_spoiler($spoiler_content);
        }
    });
}
