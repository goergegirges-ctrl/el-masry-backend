
// Categorization rules mapping
const categoryRules = [
    { prefix: "cof_", category: "كوفات", folder: "cof" },
    { prefix: "tec_", category: "تيكونات", folder: "tec" },
    { prefix: "led_", category: "ليدات", folder: "led" },
    { prefix: "bord_", category: "بورد", folder: "bord" },
    { prefix: "pcb_", category: "مساطر شاشات", folder: "pcb" },
    { prefix: "cam_", category: "كاميرات وأنظمة أمان", folder: "cam" },
    { prefix: "tv_", category: "شاشات", folder: "tv" },
    { prefix: "product_", category: "منتجات أخرى", folder: "other" }
];

const defaultCategory = "منتجات أخرى";
const defaultFolder = "other";

/**
 * Extracts category and folder info from a given string (filename or product code).
 * Returns object with category and folder.
 */
export const getCategoryInfo = (str) => {
    if (!str || typeof str !== 'string') {
        return { category: defaultCategory, folder: defaultFolder };
    }

    const lowerStr = str.toLowerCase();

    for (const rule of categoryRules) {
        if (lowerStr.startsWith(rule.prefix.toLowerCase()) || lowerStr.includes(rule.prefix.toLowerCase())) {
            return { category: rule.category, folder: rule.folder };
        }
    }

    return { category: defaultCategory, folder: defaultFolder };
};


/**
 * Maps an Arabic category name to its folder name.
 */
export const getFolderFromCategory = (categoryName) => {
    const rule = categoryRules.find(r => r.category === categoryName);
    return rule ? rule.folder : defaultFolder;
};

/**
 * Sanitizes filename: lowercase, spaces to underscores, preserves extension.
 */
export const sanitizeFilename = (filename) => {
    return filename.toLowerCase().replace(/\s+/g, '_');
};
