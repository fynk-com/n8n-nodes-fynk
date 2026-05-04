import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const BASE_URL = 'https://app.fynk.com/v1/api';

const CURRENCY_REGEX = /^[A-Z]{3};[\d.]+$/;
const CURRENCY_DURATION_REGEX = /^[A-Z]{3};[\d.]+;.+$/;
const DURATION_REGEX = /^P(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/;

function validateDynamicFieldValue(fieldType: string, value: string): string | null {
	switch (fieldType) {
		case 'currency':
			if (!CURRENCY_REGEX.test(value)) {
				return `Currency fields must be in the format "EUR;1232.00" (got: "${value}")`;
			}
			break;
		case 'currency_duration':
			if (!CURRENCY_DURATION_REGEX.test(value)) {
				return `Currency duration fields must be in the format "EUR;1232.00;yearly" (got: "${value}")`;
			}
			break;
		case 'duration':
			if (!DURATION_REGEX.test(value)) {
				return `Duration fields must be in ISO 8601 format, e.g. "P1Y" (1 year), "P6M" (6 months), "P1Y6M" (got: "${value}")`;
			}
			break;
	}
	return null;
}

type TemplateParty = { ref_uuid: string; reference: string | null; is_internal_party: boolean };

async function fetchTemplateParties(
	context: ILoadOptionsFunctions,
	templateUuid: string,
): Promise<TemplateParty[]> {
	const responseData = (await context.helpers.httpRequestWithAuthentication.call(
		context,
		'fynkApi',
		{ method: 'GET', url: `${BASE_URL}/templates/${templateUuid}`, json: true },
	)) as { data: { parties: TemplateParty[] } };
	return responseData.data.parties;
}

export class Fynk implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'fynk',
		name: 'fynk',
		icon: 'file:fynk.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Interact with the fynk API',
		defaults: {
			name: 'fynk',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'fynkApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Document',
						value: 'document',
					},
				],
				default: 'document',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['document'],
					},
				},
				options: [
					{
						name: 'Create From Template',
						value: 'createFromTemplate',
						description:
							'Create a new fynk document from a template. Ensure all dynamic field values, party details, and signatory information are confirmed before proceeding — do not create a document with missing or placeholder data.',
						action: 'Create a document from a template',
					},
				],
				default: 'createFromTemplate',
			},
			{
				displayName: 'Template',
				name: 'template',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						resource: ['document'],
						operation: ['createFromTemplate'],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'getTemplates',
							searchable: true,
						},
					},
					{
						displayName: 'By UUID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 00ac949f-4871-496f-904c-8703a33fe163',
					},
				],
			},
			{
				displayName: 'Dynamic Field Values',
				name: 'dynamicFieldValues',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Dynamic Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['document'],
						operation: ['createFromTemplate'],
					},
				},
				options: [
					{
						displayName: 'Field',
						name: 'fields',
						values: [
							{
								displayName: 'Field Name or ID',
								name: 'fieldUuid',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getTemplateDynamicFields',
									loadOptionsDependsOn: ['template'],
								},
								default: '',
								description:
									'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description:
									'Value for this field. Format by type — currency: "EUR;1232.00" · currency_duration: "EUR;1232.00;yearly" · duration: ISO 8601 e.g. "P1Y" · text: plain string · bool: "true" / "false".',
							},
						],
					},
				],
			},
			{
				displayName: 'Parties',
				name: 'parties',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Party',
				default: {},
				displayOptions: {
					show: {
						resource: ['document'],
						operation: ['createFromTemplate'],
					},
				},
				options: [
					{
						displayName: 'Party',
						name: 'party',
						values: [
							{
								displayName: 'Party Name or ID',
								name: 'partyRefUuid',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getTemplateParties',
									loadOptionsDependsOn: ['template'],
								},
								default: '',
								description:
									'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
							},
							{
								displayName: 'Entity Name',
								name: 'entity_name',
								type: 'string',
								default: '',
								description: 'Name of the company or person representing this party',
							},
							{
								displayName: 'Address',
								name: 'address',
								type: 'string',
								default: '',
								description: 'Address of the party',
							},
						],
					},
				],
			},
			{
				displayName: 'Signatories',
				name: 'signatories',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Signatory',
				default: {},
				displayOptions: {
					show: {
						resource: ['document'],
						operation: ['createFromTemplate'],
					},
				},
				options: [
					{
						displayName: 'Signatory',
						name: 'signatory',
						values: [
							{
								displayName: 'Email',
								name: 'email',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'name@example.com',
								description: 'Email address of the signatory',
							},
							{
								displayName: 'First Name',
								name: 'first_name',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Last Name',
								name: 'last_name',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Mobile Phone',
								name: 'mobile_phone',
								type: 'string',
								default: '',
								placeholder: 'e.g. +447951123456',
								description: 'Mobile phone number in E.164 format',
							},
							{
								displayName: 'Party Name or ID',
								name: 'partyRefUuid',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getTemplateExternalParties',
									loadOptionsDependsOn: ['template'],
								},
								default: '',
								description:
									'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
							},
							{
								displayName: 'Title',
								name: 'title',
								type: 'string',
								default: '',
								placeholder: 'e.g. Sales Manager',
							},
						],
					},
				],
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['document'],
						operation: ['createFromTemplate'],
					},
				},
				options: [
					{
						displayName: 'Document Name',
						name: 'name',
						type: 'string',
						default: '',
						description: 'Name for the new document. Defaults to the template name if omitted.',
					},
					{
						displayName: 'Initial Stage',
						name: 'initial_stage',
						type: 'options',
						default: 'draft',
						options: [
							{
								name: 'Draft',
								value: 'draft',
							},
							{
								name: 'Signing',
								value: 'signing',
							},
						],
						description:
							'Stage the document is moved to after creation. Moving to Signing may require dynamic fields, parties, and signatories to be set.',
					},
					{
						displayName: 'Owner Emails',
						name: 'owner_emails',
						type: 'string',
						typeOptions: {
							multipleValues: true,
						},
						default: [],
						description: 'Email addresses to assign as owners',
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			async getTemplates(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const responseData = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'fynkApi',
					{ method: 'GET', url: `${BASE_URL}/templates`, json: true },
				)) as { data: Array<{ uuid: string; name: string }> };

				let templates = responseData.data;
				if (filter) {
					templates = templates.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()));
				}

				return {
					results: templates.map((t) => ({ name: t.name, value: t.uuid })),
				};
			},
		},

		loadOptions: {
			async getTemplateParties(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const template = this.getCurrentNodeParameter('template') as { value: string } | string;
				const templateUuid = typeof template === 'object' ? template.value : template;
				if (!templateUuid) return [];

				const parties = await fetchTemplateParties(this, templateUuid);
				return parties.map((party) => ({
					name: party.reference ?? party.ref_uuid,
					value: party.ref_uuid,
				}));
			},

			async getTemplateExternalParties(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const template = this.getCurrentNodeParameter('template') as { value: string } | string;
				const templateUuid = typeof template === 'object' ? template.value : template;
				if (!templateUuid) return [];

				const parties = await fetchTemplateParties(this, templateUuid);
				return parties
					.filter((party) => !party.is_internal_party)
					.map((party) => ({
						name: party.reference ?? party.ref_uuid,
						value: party.ref_uuid,
					}));
			},

			async getTemplateDynamicFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const template = this.getCurrentNodeParameter('template') as { value: string } | string;
				const templateUuid = typeof template === 'object' ? template.value : template;
				if (!templateUuid) return [];

				const responseData = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'fynkApi',
					{ method: 'GET', url: `${BASE_URL}/templates/${templateUuid}`, json: true },
				)) as {
					data: {
						dynamic_fields: Array<{
							ref_uuid: string;
							name: string;
							type: string;
							is_mandatory: boolean;
						}>;
					};
				};

				return responseData.data.dynamic_fields.map((field) => ({
					name: `${field.name} [${field.type}]${field.is_mandatory ? ' *' : ''}`,
					value: `${field.ref_uuid}|${field.type}`,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'document') {
					if (operation === 'createFromTemplate') {
						const templateUuid = this.getNodeParameter('template', i, null, {
							extractValue: true,
						}) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						const dynamicFieldValues = this.getNodeParameter('dynamicFieldValues', i) as {
							fields?: Array<{ fieldUuid: string; value: string }>;
						};
						const partiesParam = this.getNodeParameter('parties', i) as {
							party?: Array<{ partyRefUuid: string; entity_name: string; address: string }>;
						};
						const signatoriesParam = this.getNodeParameter('signatories', i) as {
							signatory?: Array<{
								partyRefUuid: string;
								email: string;
								first_name: string;
								last_name: string;
								title: string;
								mobile_phone: string;
							}>;
						};

						const body: IDataObject = { template_uuid: templateUuid };

						if (additionalFields.name) body.name = additionalFields.name;
						if (additionalFields.initial_stage) body.initial_stage = additionalFields.initial_stage;
						if (
							Array.isArray(additionalFields.owner_emails) &&
							additionalFields.owner_emails.length > 0
						) {
							body.owner_emails = additionalFields.owner_emails;
						}

						const fieldEntries = dynamicFieldValues.fields ?? [];
						if (fieldEntries.length > 0) {
							const dynamicValues: IDataObject = {};

							for (const entry of fieldEntries) {
								if (!entry.fieldUuid) continue;

								// Value is encoded as "ref_uuid|type" when picked from the list.
								// When set via expression it is a plain ref_uuid — skip type validation.
								const [refUuid, fieldType] = entry.fieldUuid.split('|');

								if (fieldType) {
									const error = validateDynamicFieldValue(fieldType, entry.value);
									if (error) {
										throw new NodeOperationError(
											this.getNode(),
											`Dynamic field validation failed: ${error}`,
											{ itemIndex: i },
										);
									}
								}

								dynamicValues[refUuid] = entry.value;
							}

							body.dynamic_field_values = dynamicValues;
						}

						const partyEntries = partiesParam.party ?? [];
						if (partyEntries.length > 0) {
							body.parties = Object.fromEntries(
								partyEntries
									.filter((p) => p.partyRefUuid)
									.map((p) => [p.partyRefUuid, { entity_name: p.entity_name, address: p.address }]),
							);
						}

						const signatoryEntries = signatoriesParam.signatory ?? [];
						if (signatoryEntries.length > 0) {
							const grouped: Record<string, IDataObject[]> = {};
							for (const s of signatoryEntries) {
								if (!s.partyRefUuid || !s.email) continue;
								if (!grouped[s.partyRefUuid]) grouped[s.partyRefUuid] = [];
								const signatory: IDataObject = { email: s.email };
								if (s.first_name) signatory.first_name = s.first_name;
								if (s.last_name) signatory.last_name = s.last_name;
								if (s.title) signatory.title = s.title;
								if (s.mobile_phone) signatory.mobile_phone = s.mobile_phone;
								grouped[s.partyRefUuid].push(signatory);
							}
							body.signatories = grouped;
						}

						const responseData = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'fynkApi',
							{
								method: 'POST',
								url: `${BASE_URL}/documents/create-from-template`,
								headers: { 'Content-Type': 'application/json' },
								body,
								json: true,
							},
						);

						const executionData = this.helpers.constructExecutionMetaData(
							this.helpers.returnJsonArray(responseData as IDataObject),
							{ itemData: { item: i } },
						);
						returnData.push(...executionData);
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: (error as Error).message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
					continue;
				}
				if (error instanceof NodeOperationError) throw error;
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
