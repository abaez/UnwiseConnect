import './dispatch.css';
import * as resolve from 'table-resolver';
import * as UserActions from '../../actions/user';
import Fields from './Fields';
import JSONPretty from 'react-json-pretty';
import Queue from './Queue';
import React, { Component } from 'react';
import Table from '../Tickets/Table';
import * as searchtabular from 'searchtabular';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { format as formatDate } from 'date-fns';
import { search, dispatch as dispatchTickets } from '../../actions/tickets';
import { multiInfix } from '../../helpers/utils';

const fields = [
  {
    id: 'memberIdentifier',
    value: '',
    values: (tickets, value) => {
      let resourcePopularity = {};
      if (value) {
        // Needed to account for custom values.
        resourcePopularity[value] = 0;
      }

      tickets.map(ticket => {
        const allResources = (ticket.resources || '') + ',' + (ticket.owner ? ticket.owner.identifier : '');
        const splitResources = allResources.split(/[ ]*,[ ]*/);
        return splitResources.map(resource => {
          if (resource !== '') {
            resourcePopularity[resource] = (resourcePopularity[resource] || 0) + 1;
          }
          return resource;
        });
      });

      let resourceList = Object.keys(resourcePopularity);
      resourceList.sort((a, b) => {
        // Popularity, descending.
        const popularity = resourcePopularity[b] - resourcePopularity[a];
        if (popularity === 0) {
          // Alphabetical, ascending.
          return a.localeCompare(b);
        }
        return popularity;
      });
      return resourceList;
    },
    type: 'react-select',
    required: true,
    allowCustom: true,
  },
  {
    id: 'startDate',
    value: formatDate(new Date(), 'YYYY-MM-DD'),
    type: 'text',
    required: true,
  },
  {
    id: 'endDate',
    value: formatDate(new Date(), 'YYYY-MM-DD'),
    type: 'text',
    required: false,
  },
  {
    id: 'timezone',
    values: [
      'America/New_York',
      'America/Los_Angeles',
    ],
    value: 'America/New_York',
    type: 'select',
    required: true,
  },
  {
    id: 'startHour',
    value: 9,
    type: 'number',
    required: true,
  },
  {
    id: 'daily',
    value: 8,
    type: 'number',
    required: true,
  },
  {
    id: 'capTotalHours',
    value: undefined,
    type: 'number',
    required: false,
  },
  {
    id: 'skipByStatus',
    value: true,
    type: 'boolean',
  },
  {
    id: 'skipDuplicateMode',
    value: 'subtract',
    values: [
      'ignore',
      'skip',
      'subtract',
    ],
    type: 'select',
    required: false,
  },
  {
    id: 'setAssigned',
    value: true,
    type: 'boolean',
  },
  {
    id: 'dry',
    value: false,
    type: 'boolean',
  },
  {
    id: 'tickets',
    type: 'tickets',
    value: [],
    required: true,
  }
];

class Dispatch extends Component {
  constructor() {
    super();

    this.state = {
      fields, 
    };

    this.columns = this.columns.bind(this);
    this.addFiltered = this.addFiltered.bind(this);
    this.dispatch = this.dispatch.bind(this);
    this.onFieldChange = this.onFieldChange.bind(this);
    this.onTicketSelect = this.onTicketSelect.bind(this);
    this.resetTickets = this.resetTickets.bind(this);
    this.search = this.search.bind(this);
    this.selectedTickets = this.selectedTickets.bind(this);
    this.selectedTicketIds = this.selectedTicketIds.bind(this);
    this.isTicketSelected = this.isTicketSelected.bind(this);
    this.setTicketHours = this.setTicketHours.bind(this);
    this.toggleColumn = this.toggleColumn.bind(this);
  }

  toggleColumn(payload) {
    this.props.dispatch(UserActions.toggleColumn(payload));
  }

  columns(onChange) {
    return [
      {
        // Using a random property because it's easier than adding a new one
        // to all the rows
        property: 'mobileGuid',
        header: {
          label: 'Action',
        },
        visible: true,
        cell: {
          resolve: value => value,
          formatters: [
            (value, { rowData }) => {
              return (
                <button
                  type="button"
                  onClick={e => onChange(rowData.id)}
                >
                  { this.isTicketSelected(rowData.id) ? 'Remove' : 'Add' }
                </button>
              );
            },
          ]
        },
        filterType: 'custom',
        customFilter: (
          <button
            type="button"
            onClick={this.addFiltered}
          >
            Add All
          </button>
        ),
      },
      {
        property: 'company.name',
        header: {
          label: 'Company',
        },
        visible: true,
      },
      {
        property: 'project.name',
        header: {
          label: 'Project',
        },
        visible: true,
      },
      {
        property: 'id',
        header: {
          label: 'ID',
        },
        visible: true,
      },
      {
        property: 'phase.path',
        header: {
          label: 'Phase',
        },
        visible: true,
        cell: {
          resolve: value => `(${value})`,
          formatters: [
            (value, { rowData }) => {
              const { name, path } = rowData.phase;
              return (
                <span title={path}>
                  {name}
                </span>
              );
            }
          ]
        },
      },
      {
        property: 'summary',
        header: {
          label: 'Name',
        },
        visible: true,
      },
      {
        property: 'status.name',
        header: {
          label: 'Status',
        },
        visible: true,
        filterType: 'dropdown',
        extraOptions: [
          (column, rowValues) => {
            const closedValues = Table.closedTicketStatuses;
            const openValues = rowValues.filter(item => !closedValues.includes(item));
            return {
              label: 'All Open',
              value: openValues,
            };
          },
          {
            label: 'All Complete',
            value: Table.closedTicketStatuses,
          },
        ],
      },
    ] 
  }

  search(query, incremental) {
    let nextQuery = query;
    if (incremental) {
      nextQuery = {
        ...this.props.tickets.query,
        ...query,
      };
    }

    this.props.dispatch(search(nextQuery));
  }

  selectedTicketIds() {
    const tickets = this.state.fields.find(field => field.id === 'tickets');
    if (!tickets) {
      console.warn('No tickets field found.');
      return [];
    }

    return tickets.value.map(ticket => ticket.id);
  }

  selectedTickets() {
    return this.selectedTicketIds().map(id => {
      return this.props.tickets.flattened.find(ticket => String(ticket.id) === String(id));
    });
  }

  isTicketSelected(ticketId) {
    return this.selectedTicketIds().includes(ticketId);
  }

  resetTickets() {
    this.setState({
      fields: this.state.fields.map(field => {
        if (field.id === 'tickets') {
          return {
            ...field,
            value: [],
          };
        }

        return field;
      }),
    });
  }

  onTicketSelect(id) {
    const selectedIds = this.selectedTicketIds();
    if (selectedIds.indexOf(id) === -1) {
      // Adding a ticket
      this.setState({
        fields: this.state.fields.map(field => {
          if (field.id === 'tickets') {
            return {
              ...field,
              value: [
                ...field.value,
                { id },
              ],
            };
          }

          return field;
        }),
      });
    } else {
      // Removing a ticket
      this.setState({
        fields: this.state.fields.map(field => {
          if (field.id === 'tickets') {
            return {
              ...field,
              value: field.value.filter(ticket => ticket.id !== id),
            };
          }

          return field;
        }),
      });
    }
  }

  addFiltered(e) {
    const columns = this.columns(this.onTicketSelect);
    const { query } = this.props.tickets;
    const tickets = this.props.tickets.flattened;

    const rows = resolve.resolve({
      columns,
      method: extra => compose(
        resolve.byFunction('cell.resolve')(extra),
        resolve.nested(extra),
      )
    })(tickets);
    const searchExecutor = searchtabular.multipleColumns({ columns, query, strategy: multiInfix });
    const filteredTickets = searchExecutor(rows);

    const currentSelected = this.selectedTicketIds();
    let newIdObjects = [];
    for (let ticket of filteredTickets) {
      if (!currentSelected.includes(ticket.id)) {
        newIdObjects.push({ id: ticket.id });
      }
    }

    if (newIdObjects.length) {
      // Adding a ticket
      this.setState({
        fields: this.state.fields.map(field => {
          if (field.id === 'tickets') {
            return {
              ...field,
              value: [
                ...field.value,
                ...newIdObjects,
              ],
            };
          }

          return field;
        }),
      });
    }
  }

  onFieldChange(id, type, e) {
    let { value } = e.target;
    if (type === 'boolean') {
      value = e.target.checked;
    }

    this.setState({
      fields: this.state.fields.map(field => {
        if (field.id === id) {
          return {
            ...field,
            value,
          };
        }

        return field;
      }),
    });
  }

  setTicketHours(id, hours) {
    this.setState({
      fields: this.state.fields.map(field => {
        if (field.id === 'tickets') {
          return {
            ...field,
            value: field.value.map(ticket => {
              if (ticket.id === id) {
                return {
                  ...ticket,
                  hours,
                };
              }

              return ticket;
            }),
          };
        }

        return field;
      }),
    });
  }

  dispatch() {
    const params = Object.assign(...this.state.fields.map(field => (
      { [field.id]: field.value }
    )));

    this.props.dispatch(dispatchTickets({ params }));
  }

  render() {
    const { inProgress, response } = this.props.tickets.dispatching;

    return (
      <div>
        <div className="panel-uc panel panel-default">
          <div className="panel-uc__heading panel-heading clearfix">
            <h4>Dispatch Center</h4>
          </div>
          <div className="panel-body">
            <header className="dispatch-header">
              <form>
                <Fields 
                  fields={this.state.fields}
                  tickets={this.props.tickets.flattened}
                  onChange={this.onFieldChange}
                />
                <button 
                  className="btn btn-primary"
                  disabled={inProgress}
                  onClick={this.dispatch}
                  type="button"
                >
                  {inProgress ? 'Submitting…' : 'Submit'}
                </button>
              </form>
              {response != null && (
                <JSONPretty 
                  className="dispatch-response"
                  id="dispatch-response" 
                  json={response} 
                  style={{ marginTop: '20px' }}
                />
              )}
            </header>
            <Queue 
              onRemove={this.onTicketSelect}
              resetTickets={this.resetTickets}
              selectedTickets={this.selectedTickets()} 
              setTicketHours={this.setTicketHours}
            />
            {this.props.tickets.flattened.length > 0 && (
              <Table
                id="table-dispatch-tickets"
                columns={this.columns(this.onTicketSelect)}
                query={this.props.tickets.query}
                search={this.search}
                tickets={this.props.tickets.flattened}
                selectedTicketIds={this.selectedTicketIds()}
                toggleColumn={this.toggleColumn}
                userColumns={this.props.userColumns}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  tickets: state.tickets,
  userColumns: state.user.columns,
});


export default connect(mapStateToProps)(Dispatch);
