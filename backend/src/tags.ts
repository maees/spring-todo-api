import { z } from "zod";
import { TAGS } from "../../shared/tags";
export { resolveTags } from "../../shared/tags";
export const tagFields = {
    tags: z.array(z.enum(TAGS)).max(TAGS.length).optional(),
    tagMode: z.enum(["auto", "manual"]).optional()
};
