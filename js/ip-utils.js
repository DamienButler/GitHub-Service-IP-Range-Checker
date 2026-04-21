/**
 * IP/CIDR Utility Functions
 * Pure client-side IP address parsing, validation, and CIDR matching
 * Supports both IPv4 and IPv6
 */

const IPUtils = (() => {

    /**
     * Parse an IPv4 address into a 32-bit integer
     */
    function ipv4ToInt(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return null;
        let result = 0;
        for (let i = 0; i < 4; i++) {
            const num = parseInt(parts[i], 10);
            if (isNaN(num) || num < 0 || num > 255) return null;
            result = (result * 256) + num;
        }
        return result >>> 0; // unsigned 32-bit
    }

    /**
     * Expand an IPv6 address to full 8-group notation
     */
    function expandIPv6(ip) {
        // Remove any zone ID
        ip = ip.split('%')[0];

        // Handle :: expansion
        let parts = ip.split('::');
        if (parts.length > 2) return null;

        let head = parts[0] ? parts[0].split(':') : [];
        let tail = parts.length === 2 ? (parts[1] ? parts[1].split(':') : []) : [];

        if (parts.length === 1) {
            // No :: present
            if (head.length !== 8) return null;
        } else {
            const missing = 8 - head.length - tail.length;
            if (missing < 0) return null;
            const middle = new Array(missing).fill('0');
            head = head.concat(middle, tail);
        }

        if (head.length !== 8) return null;

        // Validate and normalize each group
        const groups = head.map(g => {
            const val = parseInt(g || '0', 16);
            if (isNaN(val) || val < 0 || val > 0xffff) return null;
            return val;
        });

        if (groups.includes(null)) return null;
        return groups;
    }

    /**
     * Parse an IPv6 address into a BigInt (128-bit)
     */
    function ipv6ToBigInt(ip) {
        const groups = expandIPv6(ip);
        if (!groups) return null;
        let result = BigInt(0);
        for (let i = 0; i < 8; i++) {
            result = (result << BigInt(16)) | BigInt(groups[i]);
        }
        return result;
    }

    /**
     * Determine if a string is IPv4, IPv6, or invalid
     */
    function getIPVersion(ip) {
        // Remove CIDR suffix if present
        const addr = ip.split('/')[0];
        if (addr.includes(':')) return 6;
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr)) return 4;
        return 0; // invalid
    }

    /**
     * Validate an IPv4 address or CIDR
     */
    function isValidIPv4(input) {
        const parts = input.split('/');
        const ip = parts[0];
        const intVal = ipv4ToInt(ip);
        if (intVal === null) return false;
        if (parts.length === 2) {
            const prefix = parseInt(parts[1], 10);
            if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
        }
        return true;
    }

    /**
     * Validate an IPv6 address or CIDR
     */
    function isValidIPv6(input) {
        const parts = input.split('/');
        const ip = parts[0];
        const groups = expandIPv6(ip);
        if (!groups) return false;
        if (parts.length === 2) {
            const prefix = parseInt(parts[1], 10);
            if (isNaN(prefix) || prefix < 0 || prefix > 128) return false;
        }
        return true;
    }

    /**
     * Validate any IP or CIDR input
     */
    function isValidInput(input) {
        const trimmed = input.trim();
        if (!trimmed) return false;
        const version = getIPVersion(trimmed);
        if (version === 4) return isValidIPv4(trimmed);
        if (version === 6) return isValidIPv6(trimmed);
        return false;
    }

    /**
     * Check if an IPv4 address or CIDR overlaps with a given CIDR range
     */
    function ipv4MatchesCIDR(inputIP, inputPrefix, cidrIP, cidrPrefix) {
        const inputInt = ipv4ToInt(inputIP);
        const cidrInt = ipv4ToInt(cidrIP);
        if (inputInt === null || cidrInt === null) return false;

        // If input is a single IP (prefix 32)
        if (inputPrefix === null || inputPrefix === 32) {
            const mask = cidrPrefix === 0 ? 0 : (~0 << (32 - cidrPrefix)) >>> 0;
            return (inputInt & mask) === (cidrInt & mask);
        }

        // Both are ranges - check for overlap
        const inputMask = inputPrefix === 0 ? 0 : (~0 << (32 - inputPrefix)) >>> 0;
        const cidrMask = cidrPrefix === 0 ? 0 : (~0 << (32 - cidrPrefix)) >>> 0;

        const inputStart = (inputInt & inputMask) >>> 0;
        const inputEnd = (inputStart | (~inputMask >>> 0)) >>> 0;
        const cidrStart = (cidrInt & cidrMask) >>> 0;
        const cidrEnd = (cidrStart | (~cidrMask >>> 0)) >>> 0;

        // Ranges overlap if one starts before the other ends
        return inputStart <= cidrEnd && cidrStart <= inputEnd;
    }

    /**
     * Check if an IPv6 address or CIDR overlaps with a given CIDR range
     */
    function ipv6MatchesCIDR(inputIP, inputPrefix, cidrIP, cidrPrefix) {
        const inputInt = ipv6ToBigInt(inputIP);
        const cidrInt = ipv6ToBigInt(cidrIP);
        if (inputInt === null || cidrInt === null) return false;

        const maxBits = BigInt(128);

        if (inputPrefix === null || inputPrefix === 128) {
            // Single IP check
            const shift = maxBits - BigInt(cidrPrefix);
            return (inputInt >> shift) === (cidrInt >> shift);
        }

        // Both are ranges
        const inputShift = maxBits - BigInt(inputPrefix);
        const cidrShift = maxBits - BigInt(cidrPrefix);

        const inputMask = ((BigInt(1) << maxBits) - BigInt(1)) ^ ((BigInt(1) << inputShift) - BigInt(1));
        const cidrMask = ((BigInt(1) << maxBits) - BigInt(1)) ^ ((BigInt(1) << cidrShift) - BigInt(1));

        const inputStart = inputInt & inputMask;
        const inputEnd = inputStart | ((BigInt(1) << inputShift) - BigInt(1));
        const cidrStart = cidrInt & cidrMask;
        const cidrEnd = cidrStart | ((BigInt(1) << cidrShift) - BigInt(1));

        return inputStart <= cidrEnd && cidrStart <= inputEnd;
    }

    /**
     * Check if an input IP/CIDR matches a given CIDR range from the meta endpoint
     * Returns true if there's any overlap
     */
    function matches(input, cidr) {
        const inputParts = input.split('/');
        const inputIP = inputParts[0];
        const inputPrefix = inputParts.length === 2 ? parseInt(inputParts[1], 10) : null;

        const cidrParts = cidr.split('/');
        const cidrIP = cidrParts[0];
        const cidrPrefix = parseInt(cidrParts[1], 10);

        const inputVersion = getIPVersion(inputIP);
        const cidrVersion = getIPVersion(cidrIP);

        // Must be same IP version
        if (inputVersion !== cidrVersion) return false;

        if (inputVersion === 4) {
            return ipv4MatchesCIDR(inputIP, inputPrefix, cidrIP, cidrPrefix);
        } else if (inputVersion === 6) {
            return ipv6MatchesCIDR(inputIP, inputPrefix, cidrIP, cidrPrefix);
        }

        return false;
    }

    return {
        isValidInput,
        getIPVersion,
        matches
    };
})();
