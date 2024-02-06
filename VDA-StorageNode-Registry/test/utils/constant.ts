import { createDatacentreStruct } from "./helpers";

export enum EnumStatus {
    removed = 0,
    removing,
    active
}

export const INVALID_COUNTRY_CODES = [
    "",         // Invalid code length
    " ",        // Invalid code length
    "A",        // Invalid code length
    "ABC",      // Invalid code length
    "ACCD",     // Invalid code length
    "SG"        // Capital letters in the code
];

export const INVALID_REGION_CODES = [
    "",                 // region code can not empty
    "North America",    // Capital letters in the code
    "Europe"            // Capital letter in the code
]

export const DATA_CENTERS = [
    createDatacentreStruct("centre-1", "us", "north america", -90, -150),
    createDatacentreStruct("centre-2", "uk", "europe", 80, 130),
    createDatacentreStruct("centre-3", "us", "north america", -70, -120),
]

export const VALID_NUMBER_SLOTS = 20000;