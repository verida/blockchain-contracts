import { ContractFactory, Contract } from "ethers";
import { ethers } from "hardhat";

export const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 }

interface SelectorType {
    [key: number] : any;
    contract: Contract;
    remove: any;
    get: any;
}

// get function selectors from ABI
// export function getSelectors(contract: ContractFactory | Contract) : SelectorType {
export function getSelectors(contract: any, registeredSelectors?: string[]) : any {
    let selectors : any = [];
    contract.interface.forEachFunction((functionFragment: any) => {
        const selector = functionFragment.selector
        if (registeredSelectors === undefined) {
            selectors.push(selector);
        } else if (registeredSelectors.indexOf(selector) === -1) {
            selectors.push(selector);
        }
    })
    selectors.contract = contract;
    selectors.remove = remove;
    selectors.get = get;
    // console.log("##############3", selectors)
    return selectors;
}

// get function selector from function signature
export function getSelector(func: any) {
    const abiInterface = new ethers.Interface([func]);
    let selectors: any = [];
    abiInterface.forEachFunction(fragment => {
        selectors.push(fragment.selector);
    })
    return selectors[0];
}

// used with getSelectors to remove selectors from an array of selectors
// functionNames argument is an array of function signatures
export function remove(this: any, functionNames: string[]) {
    const selectors = this.filter((v: any) => {
        for (const functionName of functionNames) {
            if (v === this.contract.interface.getFunction(functionName).selector) {
                return false;
            }
        }
        return true;
    })
    selectors.contract = this.contract;
    selectors.remove = this.remove;
    selectors.get = this.get;
    return selectors;
}

// used with getSelectors to get selectors from an array of selectors
// functionNames argument is an array of function signatures
export function get(this: any, functionNames: string[]) {
    const selectors = this.filter((v: any) => {
        for (const functionName of functionNames) {
            if (v === this.contract.interface.getFunction(functionName).selector) {
                return true;
            }
        }
        return false;
    })
    selectors.contract = this.contract;
    selectors.remove = this.remove;
    selectors.get = this.get;
    return selectors;
}

// remove selectors using an array of signatures
/**
 * 
 * @param selectors Array of selectors
 * @param signatures list of function signatures
 * @returns 
 */
export function removeSelectors (selectors: any, signatures: string[]) {
    const abi = signatures.map(v =>'function ' + v);
    const iface = new ethers.Interface(abi)
    const functionNames = signatures.map(v => v.substring(0, v.indexOf('(')));
    const removeSelectors = functionNames.map(v => iface.getFunction(v)?.selector)
    selectors = selectors.filter((v:any) => !removeSelectors.includes(v))
    return selectors
}
  
// find a particular address position in the return value of diamondLoupeFacet.facets()
export function findAddressPositionInFacets (facetAddress: any, facets: any) {
    for (let i = 0; i < facets.length; i++) {
        if (facets[i].facetAddress === facetAddress) {
            return i
        }
    }
}
