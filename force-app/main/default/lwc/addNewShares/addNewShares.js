import { LightningElement, api, track, wire } from 'lwc';
import Search from '@salesforce/label/c.Search';
import PublicGroups from '@salesforce/label/c.PublicGroups';
import Roles from '@salesforce/label/c.Roles';
import Users from '@salesforce/label/c.Users';

import getSharings from '@salesforce/apex/LightningSharing.getSharings';
import doSOSL from '@salesforce/apex/LightningSharing.doSOSL';

import { refreshApex } from '@salesforce/apex';

import {
  buttonStyling,
  sharingButtonColumns,
  shareUpdate,
  shareDelete
} from 'c/sharingButtonSupport';

export default class AddNewShares extends LightningElement {
  @api recordId;
  @track label = {
    Search
  };

  // call this when you know the sharing table is out of sync
  @api refresh() {
    console.log('addNewShares: refreshing');
    refreshApex(this._refreshable);
  }

  _refreshable;

  types = [
    { value: 'group', label: PublicGroups },
    { value: 'userrole', label: Roles },
    { value: 'user', label: Users }
  ];
  _selectedType;

  columns = [{ label: 'Name', fieldName: 'Name' }].concat(sharingButtonColumns);

  @track searchResults = [];
  existingShares = [];

  @wire(getSharings, { recordId: '$recordId' })
  wiredSharings(result) {
    this._refreshable = result;
    if (result.error) {
      console.log(result.error);
    } else if (result.data) {
      console.log(JSON.parse(result.data));
      this.existingShares = JSON.parse(result.data);
      this.updateSharingLevelButtons();
    }
  }

  typeChange(event) {
    this._selectedType = event.detail.value;
    console.log(`type is now ${this._selectedType}`);

    // clear the results
    this.searchResults = [];
    // TODO: how clear the search box
  }

  async search(event) {
    this.searchResults = [];
    // verify length
    const searchString = event.detail.value
      .trim()
      .replace(/\*/g)
      .toLowerCase();

    if (searchString.length <= 2) {
      return;
    }

    const results = JSON.parse(
      await doSOSL({
        searchString,
        objectType: this._selectedType
      })
    );

    console.log(results);
    const finalResults = [];

    //TODO: compare to existing shares to highlight+disable buttons
    results.forEach(result => {
      // make some types a bit nicer
      if (this._selectedType === 'user') {
        result.Name = `${result.Name} (${this.translateTypes(
          result.UserType
        )})`;
      } else {
        result.Name = `${result.Name} (${this.translateTypes(result.Type)})`;
      }
      finalResults.push(result);
    });

    this.searchResults = finalResults;
    this.updateSharingLevelButtons();
  }

  updateSharingLevelButtons() {
    const newArray = [];

    this.searchResults.forEach(result => {
      newArray.push({
        ...result,
        ...buttonStyling(result.Id, this.existingShares)
      });
    });

    this.searchResults = newArray;
  }

  async handleRowAction(event) {
    console.log('heard action called');
    console.log(event);
    console.log(JSON.parse(JSON.stringify(event.detail)));

    switch (event.detail.action.name) {
      case 'read':
        await shareUpdate(event.detail.row.Id, this.recordId, 'Read');
        this.refresh();
        // await this.updateShares(event.detail.row, 'Read');
        break;
      case 'read_write':
        await shareUpdate(event.detail.row.Id, this.recordId, 'Edit');
        this.refresh();
        // await this.updateShares(event.detail.row, 'Edit');
        break;
      case 'none':
        await shareDelete(event.detail.row.Id, this.recordId);
        this.refresh();
    }
  }

  translateTypes(userType) {
    if (userType === 'PowerCustomerSuccess') {
      return 'Customer + Sharing';
    } else if (userType === 'PowerPartner') {
      return 'Partner';
    } else if (userType === 'CustomerSuccess') {
      return 'Customer';
    } else if (userType === 'CsnOnly') {
      return 'Chatter';
    } else if (userType === 'CSPLitePortal') {
      return 'High Volume Customer';
    } else {
      return userType;
    }
  }

}