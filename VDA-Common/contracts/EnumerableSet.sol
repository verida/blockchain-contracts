// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

library EnumerableSet {
    struct StringSet {
        string[] _values;
        mapping(string => uint256) _indexes;
    }

    function add(StringSet storage set, string memory value) internal returns (bool) {
        if (!contains(set, value)) {
            set._values.push(value);
            // The value is stored at length-1, but we add 1 to all indexes
            // and use 0 as a sentinel value
            set._indexes[value] = set._values.length;
            return true;
        } else {
            return false;
        }
    }

    function remove(StringSet storage set, string memory value) internal returns (bool) {
        // We read and store the value's index to prevent multiple reads from the same storage slot
        uint256 valueIndex = set._indexes[value];

        if (valueIndex != 0) {
            // Equivalent to contains(set, value)
            // To delete an element from the _values array in O(1), we swap the element to delete with the last one in
            // the array, and then remove the last element (sometimes called as 'swap and pop').
            // This modifies the order of the array, as noted in {at}.

            uint256 toDeleteIndex = valueIndex - 1;
            uint256 lastIndex = set._values.length - 1;

            if (lastIndex != toDeleteIndex) {
                string memory lastValue = set._values[lastIndex];

                // Move the last value to the index where the value to delete is
                set._values[toDeleteIndex] = lastValue;
                // Update the index for the moved value
                set._indexes[lastValue] = valueIndex; // Replace lastValue's index to valueIndex
            }

            // Delete the slot where the moved value was stored
            set._values.pop();

            // Delete the index for the deleted slot
            delete set._indexes[value];

            return true;
        } else {
            return false;
        }
    }

    function clear(StringSet storage set) internal {
        uint len = set._values.length;
        if (len > 0) {
            string memory value;
            for (uint i; i < len;) {
                value = set._values[i];
                delete set._indexes[value];
                unchecked { ++i; }
            }
            delete set._values;
        }
    }

    function contains(StringSet storage set, string memory value) internal view returns (bool) {
        return set._indexes[value] != 0;
    }

    function length(StringSet storage set) internal view returns (uint256) {
        return set._values.length;
    }

    function at(StringSet storage set, uint256 index) internal view returns (string memory) {
        return set._values[index];
    }

    function values(StringSet storage set) internal view returns (string[] memory) {
        return set._values;
    }

}