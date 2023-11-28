// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibDiamond } from "./LibDiamond.sol";

error InvalidCountryCode();
error InvalidRegionCode();
error InvalidLatitude();
error InvalidLongitude();


library LibUtils {
    /**
     * @notice Check whether the value is lowercase string
     * @param value String value to check
     * @return true if value is lowercase
     */
    function isLowerCase(string calldata value) internal pure returns(bool) {
        bytes memory _baseBytes = bytes(value);
        for (uint i; i < _baseBytes.length;) {
            if (_baseBytes[i] >= 0x41 && _baseBytes[i] <= 0x5A) {
                return false;
            }
            unchecked { ++i; }
        }

        return true;
    }

    /**
     * @notice Check validity of country code
     * @param countryCode Unique two-character string code
     */
    function validateCountryCode(string calldata countryCode) internal pure {
        if (bytes(countryCode).length != 2 || !isLowerCase(countryCode)) {
            revert InvalidCountryCode();
        }
    }

    /**
     * @notice Check validity of region code
     * @param regionCode Unique region string code
     */
    function validateRegionCode(string calldata regionCode) internal pure {
        if (bytes(regionCode).length == 0 || !isLowerCase(regionCode)) {
            revert InvalidRegionCode();
        }
    }

    /**
     * @notice Check validity of latitude and longitude values
     * @param lat Latitude
     * @param long Longitude
     */
    function validateGeoPosition(int lat, int long) internal pure {
        uint8 DECIMAL = LibDiamond.decimal();
        
        if ( lat < -90 * int(10 ** DECIMAL) || lat > 90 * int(10 ** DECIMAL)) {
            revert InvalidLatitude();
        }

        if (long < -180 * int(10 ** DECIMAL) || long > 180 * int(10 ** DECIMAL)) {
            revert InvalidLongitude();
        }
    }
}
