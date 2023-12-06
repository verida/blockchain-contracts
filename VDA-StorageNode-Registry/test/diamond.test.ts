/* global describe it before ethers */

import { getSelectors, FacetCutAction, removeSelectors, findAddressPositionInFacets } from '../scripts/libraries/diamond';

import { deploy } from "../scripts/libraries/deployment";
import { ethers } from 'hardhat';
import { DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet } from '../typechain-types';
import { expect } from 'chai';
import { createDatacenterStruct } from './utils/helpers';

const { assert } = require('chai')

describe('Diamond Test', async function () {
  let diamondAddress: string
  let diamondCutFacet: DiamondCutFacet
  let diamondLoupeFacet: DiamondLoupeFacet
  let ownershipFacet: OwnershipFacet
  let tx
  let receipt
  let result
  const addresses: any[] = []

  before(async function () {
    ({
        diamondAddress
      } = await deploy());
    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress)
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress)
    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress)
  })

  it('should have three facets -- call to facetAddresses function', async () => {
    for (const address of await diamondLoupeFacet.facetAddresses()) {
      addresses.push(address)
    }

    assert.equal(addresses.length, 3)
  })

  it('facets should have the right function selectors -- call to facetFunctionSelectors function', async () => {
    let selectors = getSelectors(diamondCutFacet)
    let result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0])
    expect(result.every(item => selectors.includes(item))).to.be.eq(true, "Have same selectors");
    selectors = getSelectors(diamondLoupeFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1])
    expect(result.every(item => selectors.includes(item))).to.be.eq(true, "Have same selectors");
    selectors = getSelectors(ownershipFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2])
    expect(result.every(item => selectors.includes(item))).to.be.eq(true, "Have same selectors");
  })

  it('selectors should be associated to facets correctly -- multiple calls to facetAddress function', async () => {
    assert.equal(
      addresses[0],
      await diamondLoupeFacet.facetAddress('0x1f931c1c')
    )
    assert.equal(
      addresses[1],
      await diamondLoupeFacet.facetAddress('0xcdffacc6')
    )
    assert.equal(
      addresses[1],
      await diamondLoupeFacet.facetAddress('0x01ffc9a7')
    )
    assert.equal(
      addresses[2],
      await diamondLoupeFacet.facetAddress('0xf2fde38b')
    )
  })

  it('should add DataCenter functions', async () => {
    const datacenterFacet = await ethers.deployContract("VDADataCenterFacet");
    await datacenterFacet.waitForDeployment();

    addresses.push(await datacenterFacet.getAddress())
    const selectors = getSelectors(datacenterFacet).remove(['removeDataCenterByName'])
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: await datacenterFacet.getAddress(),
        action: FacetCutAction.Add,
        functionSelectors: selectors
      }],
      ethers.ZeroAddress, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(await datacenterFacet.getAddress())
    expect(selectors).to.have.all.members(result, "Have same selectors");
  })

  it('should test function call', async () => {
    const datacenter = createDatacenterStruct("center-1", "us", "north america", -90, -150);

    const datacenterFacet = await ethers.getContractAt("VDADataCenterFacet", diamondAddress);
    
    const tx = await datacenterFacet.addDataCenter(datacenter);

    await expect(tx).to.emit(datacenterFacet, "AddDataCenter");
  })

  it('should add `removeDataCenterByName` function', async () => {
    const datacenterFacet = await ethers.getContractFactory("VDADataCenterFacet");
    const selectors = getSelectors(datacenterFacet).get(['removeDataCenterByName'])
    const datacenterFacetAddress = addresses[3];
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: datacenterFacetAddress,
        action: FacetCutAction.Add,
        functionSelectors: selectors
      }],
      ethers.ZeroAddress, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(datacenterFacetAddress)
    expect(getSelectors(datacenterFacet)).to.have.all.members(result, "Have same selectors");
  })

  it('should remove some datacenter functions', async () => {
    const datacenterFacet = await ethers.getContractAt("VDADataCenterFacet", diamondAddress)
    const functionsToKeep = ['addDataCenter', 'removeDataCenter', 'getDataCenters']
    const selectors = getSelectors(datacenterFacet).remove(functionsToKeep)
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.ZeroAddress,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.ZeroAddress, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3])
    expect(getSelectors(datacenterFacet).get(functionsToKeep)).to.have.all.members(result, "Have same selectors");
  })
  
  it('remove all functions and facets accept \'diamondCut\' and \'facets\'', async () => {
    let selectors = []
    let facets = await diamondLoupeFacet.facets()
    for (let i = 0; i < facets.length; i++) {
      selectors.push(...facets[i].functionSelectors)
    }
    selectors = removeSelectors(selectors, ['facets()', 'diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)'])
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.ZeroAddress,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.ZeroAddress, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    facets = await diamondLoupeFacet.facets()
    
    assert.equal(facets.length, 2)
    assert.equal(facets[0][0], addresses[0])
    expect(['0x1f931c1c']).to.have.all.members(facets[0][1]);
    assert.equal(facets[1][0], addresses[1])
    expect(['0x7a0ed627']).to.have.all.members(facets[1][1]);
  })

  it('add most functions and facets', async () => {
    const diamondLoupeFacetSelectors = getSelectors(diamondLoupeFacet).remove(['supportsInterface(bytes4)'])
    const dataCenterFacet = await ethers.getContractFactory("VDADataCenterFacet")
    // Any number of functions from any number of facets can be added/replaced/removed in a
    // single transaction
    const cut = [
      {
        facetAddress: addresses[1],
        action: FacetCutAction.Add,
        functionSelectors: diamondLoupeFacetSelectors.remove(['facets()'])
      },
      {
        facetAddress: addresses[2],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(ownershipFacet)
      },
      {
        facetAddress: addresses[3],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(dataCenterFacet)
      }
    ]
    tx = await diamondCutFacet.diamondCut(cut, ethers.ZeroAddress, '0x', { gasLimit: 8000000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    const facets = await diamondLoupeFacet.facets()
    const facetAddresses = await diamondLoupeFacet.facetAddresses()
    assert.equal(facetAddresses.length, 4)
    assert.equal(facets.length, 4)
    expect(addresses).to.have.all.members(facetAddresses);
    assert.equal(facets[0][0], facetAddresses[0], 'first facet')
    assert.equal(facets[1][0], facetAddresses[1], 'second facet')
    assert.equal(facets[2][0], facetAddresses[2], 'third facet')
    assert.equal(facets[3][0], facetAddresses[3], 'fourth facet')
    expect(getSelectors(diamondCutFacet)).to.have.all.members(facets[findAddressPositionInFacets(addresses[0], facets)!][1])
    expect(diamondLoupeFacetSelectors).to.have.all.members(facets[findAddressPositionInFacets(addresses[1], facets)!][1]);
    expect(getSelectors(ownershipFacet)).to.have.all.members(facets[findAddressPositionInFacets(addresses[2], facets)!][1]);
    expect(getSelectors(dataCenterFacet)).to.have.all.members(facets[findAddressPositionInFacets(addresses[3], facets)!][1]);
  })
})
